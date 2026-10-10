const $ = (id) => document.getElementById(id);
let dataset = null;

const fmt = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0
}).format(Math.round(value / 1000) * 1000);

function initForm(data) {
  const brands = [...new Set(data.models.map(x => x.brand))].sort();
  $("brand").innerHTML = brands.map(b => `<option>${escapeHtml(b)}</option>`).join("");
  updateModels();
  $("brand").addEventListener("change", updateModels);
  $("year").value = new Date().getFullYear() - 5;
  $("year").max = new Date().getFullYear();
  $("year-now").textContent = new Date().getFullYear();
  $("car-form").addEventListener("submit", calculate);
  $("data-note").textContent = data.disclaimer;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function updateModels() {
  const brand = $("brand").value;
  const models = dataset.models.filter(x => x.brand === brand).map(x => x.model).sort();
  $("model").innerHTML = models.map(m => `<option>${escapeHtml(m)}</option>`).join("");
}
function pct(n) { return `${n > 0 ? "+" : ""}${Math.round(n * 100)}%`; }

function findComparables(input) {
  const records = dataset.records.filter(r => r.brand === input.brand && r.model === input.model);
  const ranked = records.map(r => {
    const yearGap = Math.abs(r.year - input.year);
    const fuelMatch = r.fuel === input.fuel;
    const transMatch = r.transmission === input.transmission;
    if (yearGap > 3 || !fuelMatch || !transMatch) return null;
    let score = 30;
    score += Math.max(0, 25 - yearGap * 9); // year similarity
    score += 15; // exact fuel
    score += 10; // exact transmission
    const kmRatio = input.km > 0 ? Math.abs(r.km - input.km) / Math.max(input.km, r.km, 1) : 1;
    score += Math.max(0, 15 - kmRatio * 20);
    score += r.locationScope === "jorhat" ? 10 : 5;
    return {...r, score: Math.max(1, score), yearGap};
  }).filter(Boolean);

  // Basic outlier protection: remove values far from the median when at least 4 matches exist.
  if (ranked.length >= 4) {
    const sorted = ranked.map(r => r.askingPrice).sort((a,b) => a-b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return ranked.filter(r => r.askingPrice >= median * 0.55 && r.askingPrice <= median * 1.65);
  }
  return ranked;
}

function adjustments(input) {
  const age = Math.max(1, new Date().getFullYear() - input.year);
  const expectedKm = age * 12000;
  const ratio = input.km / expectedKm;
  let mileage = ratio <= .70 ? .05 : ratio <= .90 ? .03 : ratio <= 1.10 ? 0 : ratio <= 1.30 ? -.04 : ratio <= 1.60 ? -.08 : -.12;
  const owner = ({1:.03,2:0,3:-.04,4:-.08})[input.owners] ?? 0;
  const condition = ({excellent:.06,good:.03,average:-.05,poor:-.12})[input.condition] ?? 0;
  const accident = ({none:0,minor:-.05,major:-.15,unknown:-.03})[input.accident] ?? 0;
  const service = ({complete:.03,partial:0,none:-.05,unknown:-.02})[input.service] ?? 0;
  const raw = mileage + owner + condition + accident + service;
  const total = Math.max(-.20, Math.min(.12, raw));
  return {age, expectedKm, ratio, mileage, owner, condition, accident, service, raw, total};
}

function calculate(event) {
  event.preventDefault();
  const input = {
    brand: $("brand").value, model: $("model").value,
    year: Number($("year").value), fuel: $("fuel").value,
    transmission: $("transmission").value, km: Number($("km").value),
    owners: Number($("owners").value), condition: $("condition").value,
    accident: $("accident").value, service: $("service").value
  };
  const results = $("results");
  if (!input.year || input.year < 1990 || input.year > new Date().getFullYear() || input.km < 0 || !Number.isFinite(input.km)) {
    results.innerHTML = `<div class="warning">Please enter a valid registration year and kilometre reading.</div>`;
    return;
  }
  const comps = findComparables(input);
  const localCount = comps.filter(c => c.locationScope === "jorhat").length;
  if (comps.length < 2) {
    results.innerHTML = `<div class="result-kicker">Estimate unavailable</div><h2>Not enough comparable data</h2>
      <p>We don't currently have at least two reasonably similar ${escapeHtml(input.model)} listings matching year, fuel, and transmission.</p>
      <div class="warning">To avoid inventing a price, this calculator won't show a rupee estimate. Add verified listings to <code>cars.json</code> and try again.</div>
      <p class="fineprint">Current dataset: ${dataset.records.filter(r => r.model === input.model && r.brand === input.brand).length} record(s) for this model. This is a small starter dataset, not a complete Jorhat market survey.</p>`;
    return;
  }

  const weighted = comps.reduce((sum, c) => sum + c.askingPrice * c.score, 0) / comps.reduce((sum,c) => sum + c.score, 0);
  const adj = adjustments(input);
  const fair = weighted * (1 + adj.total);
  const low = fair * .95, high = fair * 1.05;
  const buyLow = fair * .95, buyHigh = fair;
  const askLow = fair, askHigh = fair * 1.08;
  const confidenceScore = Math.min(100, 25 + comps.length * 12 + (localCount ? 15 : 0) - Math.max(...comps.map(c => c.yearGap)) * 5);
  const level = confidenceScore >= 80 ? "High" : confidenceScore >= 55 ? "Medium" : "Low";
  const factorText = [
    ["Mileage", adj.mileage],["Owner count", adj.owner],["Condition", adj.condition],
    ["Accident history", adj.accident],["Service history", adj.service]
  ].map(([name, value]) => `<li>${name}: <strong>${pct(value)}</strong></li>`).join("");
  const scope = localCount >= 2 ? "Jorhat listing comparisons" : localCount === 1 ? "limited Jorhat data plus similar listings" : "regional listing comparisons";
  const compRows = comps.slice(0,6).map(c => `<li>${c.year} ${escapeHtml(c.model)} · ${c.km.toLocaleString("en-IN")} km · ${c.owners} owner(s) · <strong>${fmt(c.askingPrice)}</strong> asking (${escapeHtml(c.location)})</li>`).join("");
  results.innerHTML = `
    <div class="result-kicker">Estimated fair asking-price reference</div>
    <div class="price">${fmt(fair)}</div>
    <p class="price-range">Indicative range: ${fmt(low)} – ${fmt(high)}</p>
    <span class="confidence ${level.toLowerCase()}">${level} confidence · ${confidenceScore}/100</span>
    <div class="stats">
      <div class="stat"><small>Buyer negotiation range</small><strong>${fmt(buyLow)} – ${fmt(buyHigh)}</strong></div>
      <div class="stat"><small>Possible seller asking range</small><strong>${fmt(askLow)} – ${fmt(askHigh)}</strong></div>
      <div class="stat"><small>Comparables used</small><strong>${comps.length}</strong></div>
      <div class="stat"><small>Local Jorhat matches</small><strong>${localCount}</strong></div>
    </div>
    ${localCount < 2 ? `<div class="warning">Local-data warning: this estimate has fewer than two Jorhat comparisons. Treat it as a rough regional reference, not a reliable local valuation.</div>` : ""}
    <div class="result-section"><h3>Why this estimate?</h3>
      <p>Comparable asking-price average: <strong>${fmt(weighted)}</strong>. Combined adjustments: <strong>${pct(adj.total)}</strong> (capped between −20% and +12%).</p>
      <ul>${factorText}</ul>
      <p class="fineprint">Mileage is compared with a rough benchmark of 12,000 km per year. This is a simple rule of thumb, not a mechanical assessment.</p>
    </div>
    <div class="result-section"><h3>Comparable listings in the dataset</h3><ul>${compRows}</ul>
      <p class="fineprint">Matching scope: ${scope}. Prices are asking-price snapshots and may be outdated. Variant, trim, insurance, tax, condition, and seller urgency are not fully modelled.</p>
    </div>
    <div class="result-section"><h3>Before you buy or sell</h3>
      <p>Use this only as a starting point. Verify the live listing, inspect the car, check documents and pending dues, and negotiate after a mechanic's inspection.</p>
    </div>`;
}

fetch("cars.json")
  .then(response => { if (!response.ok) throw new Error("Could not load cars.json"); return response.json(); })
  .then(data => { dataset = data; initForm(data); })
  .catch(() => {
    $("results").innerHTML = `<div class="warning"><strong>Dataset could not load.</strong><br>Upload <code>index.html</code>, <code>style.css</code>, <code>calculator.js</code>, and <code>cars.json</code> to the same GitHub Pages folder. For local testing, use a simple local web server instead of opening index.html directly.</div>`;
    $("data-note").textContent = "Dataset loading failed. Check that cars.json is in the same folder.";
  });
