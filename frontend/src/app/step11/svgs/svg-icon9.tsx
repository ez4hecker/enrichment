export default function Icon9({ dittoId }: { dittoId?: string }) {
  return (
    <svg className="w-5 h-5 block overflow-hidden align-middle focus:[outline-style:auto] focus:outline-[5px]" data-component="icon" fill="none" height="20" width="20" xmlns="http://www.w3.org/2000/svg" data-ditto-id={dittoId}>
      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12.5 2.5H17.5V7.5" />
      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M7.5 17.5H2.5V12.5" />
      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M17.5 2.5L11.67 8.33" />
      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M2.5 17.5L8.33 11.67" />
    </svg>
  );
}
