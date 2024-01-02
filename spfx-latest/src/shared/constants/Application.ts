export enum StorageType {
  //Database = 'database',
  //Local = 'localstorage',
  SharePoint = 'splist',
}

export enum GeminiModels {
  Pro = 'gemini-pro',
  Vision = 'gemini-pro-vision',
}

export const GeminiModelTokenLimits: { [key: string]: number } = {
  [GeminiModels.Pro]: 2048,
  [GeminiModels.Vision]: 4096,
};

export default class Application {
  public static readonly Name: string = 'GeminiAI';
  public static readonly MaxChatNameLength: number = 255;
  public static readonly MaxChatNameLengthEncrypted: number = 150;
}
