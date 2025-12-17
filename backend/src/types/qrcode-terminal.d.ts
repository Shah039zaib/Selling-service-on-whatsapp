declare module 'qrcode-terminal' {
  interface QRCodeOptions {
    small?: boolean;
  }

  function generate(text: string, options?: QRCodeOptions, callback?: (qrcode: string) => void): void;
  function setErrorLevel(level: string): void;

  export { generate, setErrorLevel };
}
