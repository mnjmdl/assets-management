declare module 'qrcode' {
  export interface QRCodeOptions {
    version?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    maskPattern?: number;
    toSJISFunc?: Function;
  }

  export interface QRCodeRenderersOptions extends QRCodeOptions {
    margin?: number;
    scale?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(text: string, options?: QRCodeRenderersOptions): Promise<string>;
  export function toString(text: string, options?: QRCodeRenderersOptions & { type?: 'svg' | 'utf8' }): Promise<string>;
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: QRCodeRenderersOptions): Promise<void>;
}

