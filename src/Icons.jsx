import React from "react";
const paths = {
  spark: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z",
  particles:
    "M9 5a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM20 8a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM14 18a3 3 0 1 0-6 0 3 3 0 0 0 6 0ZM13 10h.01M3 13h.01M20 19h.01",
  orb: "M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0ZM3 12h18M12 3c-5 4-5 14 0 18 5-4 5-14 0-18Z",
  nodes: "M3 3h6v6H3ZM15 15h6v6h-6ZM9 6h6v12M15 18H9",
  play: "m8 4 12 8-12 8Z",
  pause: "M8 5v14M16 5v14",
  reset: "M3 10a9 9 0 1 1 2 9M3 4v6h6",
  save: "M4 3h13l3 3v15H4ZM8 3v6h8V3M8 21v-8h8v8",
  folder: "M3 7V4h6l3 3h9v13H3Z",
  expand: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5",
  camera: "M8 6l2-3h4l2 3h5v14H3V6ZM16 13a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z",
  chevron: "m9 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  plus: "M12 4v16M4 12h16",
  close: "m6 6 12 12M6 18 18 6",
  attract:
    "M12 3v5m-3-3 3 3 3-3M12 21v-5m-3 3 3-3 3 3M3 12h5m-3-3 3 3-3 3M21 12h-5m3-3-3 3 3 3",
  repel:
    "M12 8V3m-3 3 3-3 3 3M12 16v5m-3-3 3 3 3-3M8 12H3m3-3-3 3 3 3M16 12h5m-3-3 3 3-3 3",
  vortex: "M12 12c-4-4 4-8 6-3 3 8-11 12-14 4C0 1 19-3 22 10",
  light:
    "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M17 12a5 5 0 1 0-10 0 5 5 0 0 0 10 0Z",
  burst: "m12 2 2 6 6-4-4 6 6 2-6 2 4 6-6-4-2 6-2-6-6 4 4-6-6-2 6-2-4-6 6 4Z",
  freeze: "M12 2v20M3 7l18 10M3 17 21 7M8 4l4 4 4-4M8 20l4-4 4 4",
  cursor: "m5 3 14 10-7 1-3 7Z",
  code: "m8 5-6 7 6 7M16 5l6 7-6 7M14 2l-4 20",
  check: "m5 12 4 4L20 5",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Z",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  record: "M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0Z",
};
export default function Icon({ name, size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.spark} />
    </svg>
  );
}
