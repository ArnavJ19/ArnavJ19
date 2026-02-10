const assets = {
  AAPL: {
    prices: generateSeries(190, 0.0010, 0.014),
    allocation: 26,
    sector: "Technology",
    beta: 1.12,
  },
  MSFT: {
    prices: generateSeries(388, 0.0009, 0.012),
    allocation: 22,
    sector: "Technology",
    beta: 1.01,
  },
  NVDA: {
    prices: generateSeries(885, 0.0015, 0.02),
    allocation: 14,
    sector: "Semiconductors",
    beta: 1.43,
  },
  JPM: {
    prices: generateSeries(182, 0.0006, 0.011),
    allocation: 16,
    sector: "Financials",
    beta: 0.94,
  },
  XOM: {
    prices: generateSeries(115, 0.0004, 0.016),
    allocation: 12,
    sector: "Energy",
    beta: 0.85,
  },
  COST: {
    prices: generateSeries(680, 0.0008, 0.01),
    allocation: 10,
    sector: "Consumer",
    beta: 0.72,
  },
};

const assetSelect = document.getElementById("assetSelect");
const rangeSelect = document.getElementById("rangeSelect");
const metricsBody = document.getElementById("metricsBody");

let priceChart;
let drawdownChart;
let allocationChart;
let sectorChart;

Object.keys(assets).forEach((ticker) => {
  const option = document.createElement("option");
  option.value = ticker;
  option.textContent = ticker;
  assetSelect.append(option);
});

assetSelect.value = "AAPL";

const dateLabels = Array.from({ length: 365 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (364 - i));
  return `${date.getMonth() + 1}/${date.getDate()}`;
});

function generateSeries(start, drift, vol) {
  const series = [start];
  for (let i = 1; i < 365; i += 1) {
    const randomShock = (Math.random() - 0.5) * vol;
    const next = series[i - 1] * (1 + drift + randomShock);
    series.push(Number(next.toFixed(2)));
  }
  return series;
}

function calculateReturns(prices) {
  return prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
}

function calculateVolatility(prices) {
  const returns = calculateReturns(prices);
  const avg = returns.reduce((acc, val) => acc + val, 0) / returns.length;
  const variance = returns.reduce((acc, val) => acc + (val - avg) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252);
}

function calcPeriodReturn(prices, days) {
  const end = prices[prices.length - 1];
  const start = prices[Math.max(prices.length - days, 0)];
  return (end - start) / start;
}

function ema(data, span = 20) {
  const k = 2 / (span + 1);
  return data.reduce((acc, price, idx) => {
    if (idx === 0) return [price];
    acc.push(price * k + acc[idx - 1] * (1 - k));
    return acc;
  }, []);
}

function drawdowns(prices) {
  let peak = prices[0];
  return prices.map((price) => {
    peak = Math.max(peak, price);
    return ((price - peak) / peak) * 100;
  });
}

function formatPct(value) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function formatNum(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function setKpi(id, title, value, change) {
  const element = document.getElementById(id);
  element.innerHTML = `
    <div class="kpi-title">${title}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-change ${change >= 0 ? "up" : "down"}">${formatPct(change)}</div>
  `;
}

function renderMetricsTable() {
  metricsBody.innerHTML = "";
  Object.entries(assets).forEach(([ticker, asset]) => {
    const prices = asset.prices;
    const row = document.createElement("tr");
    const r1m = calcPeriodReturn(prices, 22);
    const r3m = calcPeriodReturn(prices, 66);
    const vol = calculateVolatility(prices);

    row.innerHTML = `
      <td>${ticker}</td>
      <td>$${formatNum(prices.at(-1))}</td>
      <td class="${r1m >= 0 ? "up" : "down"}">${formatPct(r1m)}</td>
      <td class="${r3m >= 0 ? "up" : "down"}">${formatPct(r3m)}</td>
      <td>${(vol * 100).toFixed(1)}%</td>
      <td>${asset.beta.toFixed(2)}</td>
    `;
    metricsBody.append(row);
  });
}

function renderDashboard() {
  const ticker = assetSelect.value;
  const range = Number(rangeSelect.value);
  const prices = assets[ticker].prices.slice(-range);
  const labels = dateLabels.slice(-range);
  const e = ema(prices);
  const dd = drawdowns(prices);

  const periodReturn = calcPeriodReturn(prices, Math.min(22, prices.length - 1));
  const ytd = calcPeriodReturn(prices, prices.length - 1);
  const volatility = calculateVolatility(prices);
  const sharpe = (ytd - 0.03) / volatility;

  const totalValue = Object.values(assets).reduce(
    (sum, asset) => sum + asset.prices.at(-1) * asset.allocation,
    0,
  );

  setKpi("navKpi", "Portfolio NAV", `$${formatNum(totalValue)}`, ytd);
  setKpi("returnKpi", `${ticker} 1M Return`, formatPct(periodReturn), periodReturn);
  setKpi("volKpi", "Annualized Volatility", `${(volatility * 100).toFixed(2)}%`, -volatility / 2);
  setKpi("sharpeKpi", "Sharpe Ratio", sharpe.toFixed(2), sharpe / 4);

  if (priceChart) priceChart.destroy();
  priceChart = new Chart(document.getElementById("priceChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `${ticker} Close`,
          data: prices,
          borderColor: "#5ea0ff",
          tension: 0.28,
          pointRadius: 0,
        },
        {
          label: "EMA 20",
          data: e,
          borderColor: "#2fd39f",
          borderDash: [5, 4],
          tension: 0.22,
          pointRadius: 0,
        },
      ],
    },
    options: chartOptions(),
  });

  if (drawdownChart) drawdownChart.destroy();
  drawdownChart = new Chart(document.getElementById("drawdownChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Drawdown %",
          data: dd,
          borderColor: "#ef5c7f",
          backgroundColor: "rgba(239, 92, 127, 0.15)",
          fill: true,
          pointRadius: 0,
          tension: 0.15,
        },
      ],
    },
    options: chartOptions(),
  });

  if (allocationChart) allocationChart.destroy();
  allocationChart = new Chart(document.getElementById("allocationChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(assets),
      datasets: [
        {
          data: Object.values(assets).map((asset) => asset.allocation),
          backgroundColor: ["#5ea0ff", "#2fd39f", "#c99eff", "#f7b267", "#ef5c7f", "#66d2ff"],
        },
      ],
    },
    options: {
      plugins: {
        legend: { labels: { color: "#eff6ff" } },
      },
    },
  });

  const sectorMap = Object.values(assets).reduce((acc, asset) => {
    const contribution = asset.allocation * calcPeriodReturn(asset.prices, 66);
    acc[asset.sector] = (acc[asset.sector] || 0) + contribution;
    return acc;
  }, {});

  if (sectorChart) sectorChart.destroy();
  sectorChart = new Chart(document.getElementById("sectorChart"), {
    type: "bar",
    data: {
      labels: Object.keys(sectorMap),
      datasets: [
        {
          label: "3M weighted contribution",
          data: Object.values(sectorMap).map((value) => value * 100),
          backgroundColor: Object.values(sectorMap).map((value) =>
            value >= 0 ? "rgba(47, 211, 159, 0.65)" : "rgba(239, 92, 127, 0.65)",
          ),
        },
      ],
    },
    options: chartOptions(),
  });

  renderMetricsTable();
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#eff6ff" } },
    },
    scales: {
      x: { ticks: { color: "#b4c5e4", maxTicksLimit: 8 }, grid: { color: "#1f2d47" } },
      y: { ticks: { color: "#b4c5e4" }, grid: { color: "#1f2d47" } },
    },
  };
}

assetSelect.addEventListener("change", renderDashboard);
rangeSelect.addEventListener("change", renderDashboard);
renderDashboard();
