# Runtime lexicon data

`dictionary.txt` is the frequency-curated 50,000-word validity pool.
`lexicon.json` is the separately tagged suit/POS table; valid words without a
tagged entry default to Standard with no POS. Both are baked offline outputs used
by Node simulations and the browser/desktop bundle. They are not runtime-generated
or fetched. Run `npm run check:data` after changing either file.
