import Image from "next/image";

export default function Icon({ dittoId }: { dittoId?: string }) {
  return (
    <Image src="/logo.png" alt="GrowthInfi" width={32} height={32} className="w-auto h-7.5 block overflow-hidden align-middle focus:[outline-style:auto] focus:outline-[5px]" data-ditto-id={dittoId} />
  );
}
