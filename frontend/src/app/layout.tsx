import { ThemeProvider } from 'next-themes';
import "./globals.css";
import Providers from './components/Providers';
import { ToastContainer } from 'react-toastify';


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <Providers>
          <ToastContainer />
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
