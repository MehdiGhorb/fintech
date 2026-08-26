# Northline desk

Private FinCast paper book on [northline-finance.com](https://northline-finance.com).

Password `1963` (no username). $1,000 fake money. 50 names. 1-month FinCast signals from the local GPU.

```bash
npm install
npm run dev
```

The GPU worker lives in `tradingBot_technical`:

```bash
.venv/bin/python scripts/paper_desk.py --once --force   # first book
.venv/bin/python scripts/paper_desk.py --loop            # daytime, stop at 18:00 Paris
```
