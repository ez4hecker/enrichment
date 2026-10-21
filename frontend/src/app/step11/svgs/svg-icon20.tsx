export default function Icon20({ dittoId }: { dittoId?: string }) {
  return (
    <svg className="w-auto h-5 block shrink-0 overflow-hidden align-middle text-muted-foreground text-[1.25rem] focus:[outline-style:auto] focus:outline-[5px]" data-component="icon" aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg" focusable="false" data-ditto-id={dittoId}>
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
