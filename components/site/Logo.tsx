import Image from 'next/image';
import Link from 'next/link';

type LogoProps = {
  href: string;
  priority?: boolean;
  label?: string;
};

export function Logo({ href, priority = false, label = 'Vella' }: LogoProps) {
  return (
    <Link className="brand" href={href} aria-label={label}>
      <Image
        className="brand-icon"
        src="/vella-icon.png"
        alt=""
        width={42}
        height={42}
        priority={priority}
      />
      <span>Vella</span>
    </Link>
  );
}
