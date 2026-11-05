import './globals.css';

export const metadata = {
  title: 'ShiftStack Aviator',
  description: 'Live Aviator betting with fast mobile money payments.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
