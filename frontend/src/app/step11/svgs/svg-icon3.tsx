export default function Icon3({ dittoId }: { dittoId?: string }) {
  return (
    <svg className="w-auto h-9.5 block shrink-0 overflow-hidden align-middle text-primary text-[1.5rem] focus:[outline-style:auto] focus:outline-[5px]" data-component="icon" aria-hidden="true" fill="none" height="38" viewBox="0 0 28 38" width="28" xmlns="http://www.w3.org/2000/svg" focusable="false" data-ditto-id={dittoId}>
      <rect x="6" y="12" width="4" height="16" rx="2" transform="rotate(-90 6 12)" fill="currentColor" />
      <rect x="6" y="18" width="4" height="16" rx="2" transform="rotate(-90 6 18)" fill="currentColor" />
      <rect x="6" y="24" width="4" height="16" rx="2" transform="rotate(-90 6 24)" fill="currentColor" />
      <rect x="6" y="30" width="4" height="16" rx="2" transform="rotate(-90 6 30)" fill="currentColor" />
    </svg>
  );
}
