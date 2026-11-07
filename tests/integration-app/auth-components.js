import Link from "next/link";

export function LoginLink({ children }) {
  return <Link href="/api/auth/login">{children}</Link>;
}

export function RegisterLink({ children }) {
  return <Link href="/api/auth/register">{children}</Link>;
}

export function LogoutLink({ children, className }) {
  return (
    <Link className={className} href="/api/auth/logout">
      {children}
    </Link>
  );
}
