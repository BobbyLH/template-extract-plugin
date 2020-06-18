declare module 'template-extract-plugin' {
  export declare class TemplateExtractPlugin {
    static loader: (content: string) => void;
    constructor(options: any);
    apply(compiler: any): void;
    compilation(event: any, compilation: any): void;
    wire(event: any, compilation: any, fn: any): void;
  }

  export default TemplateExtractPlugin;
}

