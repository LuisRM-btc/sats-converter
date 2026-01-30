import { useState, useEffect } from 'react'
import { QRCode } from 'react-qr-code'
import './App.css'

const SATS_PER_BTC = 100_000_000
const API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,mxn,cad,eur'

const CURRENCIES = [
  { code: 'MXN', label: 'MXN' },
  { code: 'USD', label: 'USD' },
  { code: 'CAD', label: 'CAD' },
  { code: 'EUR', label: 'EUR' },
]

const CURRENCY_SYMBOLS = { MXN: '$', USD: '$', CAD: '$', EUR: '€' }

function App() {
  const [prices, setPrices] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fiatCurrency, setFiatCurrency] = useState('MXN')
  const [fiatAmount, setFiatAmount] = useState('')
  const [satsAmount, setSatsAmount] = useState('')
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled && data?.bitcoin) {
          setPrices(data.bitcoin)
        } else {
          throw new Error('Invalid API response')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch Bitcoin price')
          setPrices(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const btcPriceInFiat = prices ? prices[fiatCurrency.toLowerCase()] : null

  const handleFiatChange = (e) => {
    const raw = e.target.value
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
    setFiatAmount(raw)
    const num = parseFloat(raw)
    if (prices && !isNaN(num) && num >= 0) {
      const btcPrice = prices[fiatCurrency.toLowerCase()]
      const btc = num / btcPrice
      const sats = Math.round(btc * SATS_PER_BTC)
      setSatsAmount(sats.toLocaleString('en-US', { maximumFractionDigits: 0 }))
    } else {
      setSatsAmount('')
    }
  }

  const handleSatsChange = (e) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw !== '' && !/^\d+$/.test(raw)) return
    setSatsAmount(raw === '' ? '' : parseInt(raw, 10).toLocaleString('en-US'))
    const num = parseInt(raw, 10)
    if (prices && !isNaN(num) && num >= 0) {
      const btcPrice = prices[fiatCurrency.toLowerCase()]
      const btc = num / SATS_PER_BTC
      const fiat = btc * btcPrice
      setFiatAmount(fiat === 0 ? '' : formatFiat(fiat))
    } else {
      setFiatAmount('')
    }
  }

  function formatFiat(value) {
    if (value >= 1e6) return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    if (value >= 1) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return value.toFixed(4)
  }

  const displayPrice =
    btcPriceInFiat != null
      ? `1 BTC = ${CURRENCY_SYMBOLS[fiatCurrency]}${btcPriceInFiat.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${fiatCurrency}`
      : null

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Fiat ↔ Sats</h1>
        <p className="app-subtitle">Convert between fiat and Bitcoin (satoshis)</p>
      </header>

      {loading && (
        <div className="status status-loading" role="status">
          Loading BTC price…
        </div>
      )}
      {error && (
        <div className="status status-error" role="alert">
          {error}
        </div>
      )}
      {displayPrice && !loading && (
        <p className="btc-price" aria-live="polite">
          {displayPrice}
        </p>
      )}

      <main className="converter">
        <div className="input-group">
          <label htmlFor="fiat-amount">Fiat amount</label>
          <div className="input-row">
            <select
              id="fiat-currency"
              value={fiatCurrency}
              onChange={(e) => {
                setFiatCurrency(e.target.value)
                if (fiatAmount && prices) {
                  const num = parseFloat(fiatAmount.replace(/,/g, ''))
                  if (!isNaN(num)) {
                    const btcPrice = prices[e.target.value.toLowerCase()]
                    const sats = Math.round((num / btcPrice) * SATS_PER_BTC)
                    setSatsAmount(sats.toLocaleString('en-US', { maximumFractionDigits: 0 }))
                  }
                }
                if (satsAmount && prices) {
                  const num = parseInt(satsAmount.replace(/,/g, ''), 10)
                  if (!isNaN(num)) {
                    const btcPrice = prices[e.target.value.toLowerCase()]
                    const fiat = (num / SATS_PER_BTC) * btcPrice
                    setFiatAmount(formatFiat(fiat))
                  }
                }
              }}
              className="currency-select"
              aria-label="Fiat currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              id="fiat-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={fiatAmount}
              onChange={handleFiatChange}
              className="amount-input"
              aria-label="Fiat amount"
            />
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="sats-amount">Satoshis (sats)</label>
          <input
            id="sats-amount"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={satsAmount}
            onChange={handleSatsChange}
            className="amount-input amount-input-sats"
            aria-label="Satoshi amount"
          />
        </div>

        <button
          type="button"
          className="donate-btn"
          onClick={() => setShowQR(true)}
          aria-label="Donate sats via Lightning"
        >
          ⚡ Donate Sats
        </button>
      </main>

      {showQR && (
        <div
          className="donation-backdrop"
          onClick={() => setShowQR(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowQR(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="donation-modal-title"
        >
          <div
            className="donation-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="donation-modal-title" className="donation-modal-title">
              Lightning Donation
            </h2>
            <div className="donation-qr-wrap">
              <QRCode
                value="majorduck25@primal.net"
                size={200}
                level="M"
                className="donation-qr"
              />
            </div>
            <p className="donation-address">majorduck25@primal.net</p>
            <button
              type="button"
              className="donation-close"
              onClick={() => setShowQR(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
