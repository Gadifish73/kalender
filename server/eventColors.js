const EVENT_CATEGORIES = [
  { color: '#ffe066', label: 'Event' },
  { color: '#c0eb75', label: 'Wagenbau' },
  { color: '#66d9e8', label: 'sport' },
  { color: '#91a7ff', label: 'Sitzung' },
  { color: '#e599f7', label: 'Ausflug' },
  { color: '#ffa8a8', label: 'wichtig' },
];

const EVENT_COLORS = EVENT_CATEGORIES.map((c) => c.color);

module.exports = { EVENT_CATEGORIES, EVENT_COLORS, DEFAULT_EVENT_COLOR: EVENT_COLORS[0] };
