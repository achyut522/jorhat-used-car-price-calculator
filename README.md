# Jorhat Used Car Price Calculator

A small static website for estimating a used car's asking-price range from a starter set of listing observations.

## Files
- `index.html` — page structure
- `style.css` — responsive styling
- `calculator.js` — matching and calculation logic
- `cars.json` — model list and starter comparison records

## Publish with GitHub Pages
1. Create a public GitHub repository named `jorhat-used-car-price-calculator`.
2. Upload all four files to the repository root.
3. Open **Settings → Pages**.
4. Under build/deployment, choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
5. Wait for GitHub to provide the Pages URL.

## Important data limitations
- The included dataset is a starter sample, not a complete market survey.
- Values are observed asking prices, not verified transaction prices or official valuations.
- Some listing snapshots may be outdated or have incomplete trim/transmission details.
- The calculator intentionally refuses to produce an estimate if fewer than two comparable records match the selected model, year range, fuel, and transmission.
- Update `cars.json` only with listings you can verify. Keep the `askingPrice`, `location`, `source`, `observedOn`, and `note` fields accurate.
- Do not claim that a price is guaranteed, official, or the actual selling price.

## Calculation summary
1. Finds same-model listings within ±3 years with matching fuel and transmission.
2. Weights records by year, mileage similarity, and location.
3. Calculates a weighted average of asking prices.
4. Applies simple mileage, owner-count, condition, accident, and service-history adjustments.
5. Caps the combined adjustment at −20% to +12%.
6. Displays an indicative fair range of ±5%, a buyer negotiation range, and a possible seller asking range.

## Local testing
Because browsers may block `fetch()` from a `file://` URL, run a local server from this folder, or test the deployed GitHub Pages site. If Python is installed, open a terminal in the folder and run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.
