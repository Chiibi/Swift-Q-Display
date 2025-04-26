import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import localFont from 'next/font/local'
import "./globals.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

const lineSeedSans = localFont({
  src: [
    {
      path: '../../public/fonts/lineSeed/LINESeedSansTH_Rg.ttf',
      weight: '400',
      style: 'normal',
    },
  ],
  variable: "--font-line-seed"
})

export const metadata: Metadata = {
  title: "Swift-Q-Display",
  description: "Clinic queue support display",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${lineSeedSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
