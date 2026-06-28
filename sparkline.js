const LumenSparkline = (() => {
  // Input is an engagement score (higher = more active evaluation).
  function scoreColor(score) {
    if (score == null) return "#3a3a3a";
    if (score >= 60) return "#4caf50";
    if (score >= 35) return "#8ec8f0";
    return "#f0a500";
  }

  function render(scores, width = 120, height = 32) {
    const slots = scores.slice(-10);
    while (slots.length < 10) slots.unshift(null);

    const barWidth = width / 10 - 2;
    const bars = slots
      .map((score, index) => {
        const x = index * (barWidth + 2);
        const barHeight = score == null ? 4 : Math.max(4, Math.round((score / 100) * height));
        const y = height - barHeight;
        return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="1" fill="${scoreColor(score)}"/>`;
      })
      .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${bars}</svg>`;
  }

  return { render };
})();

globalThis.LumenSparkline = LumenSparkline;
