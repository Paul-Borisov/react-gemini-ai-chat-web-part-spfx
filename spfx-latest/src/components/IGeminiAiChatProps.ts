import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StorageType } from 'shared/constants/Application';
import AzureApiService from 'shared/services/AzureApiService';
import SharepointService from 'shared/services/SharepointService';

export interface IGeminiAiChatProps {
  context: WebPartContext;
  apiService: AzureApiService;
  spService: SharepointService;
  isDarkTheme: boolean;
  isFullWidthColumn: boolean;
  webPartWidth: number;
  // Azure App registration (Client ID) to authenticate SPFx requests. It must match with package-solution.json > webApiPermissionRequests > resource nane
  appId: string;
  // Base endpoint URL of APIM sevice API for Gemini AI service (if you provide api-key)
  endpointBaseUrl: string;
  // Optional SharePoint image library URL if image generation selected. Default is <currentsiteurl>/ChatImages
  spImageLibraryUrl: string;
  // Optional SharePoint list URL if StorageType === spList selected. Default is <currentsiteurl>/Lists/dbChats
  spListUrl: string;
  // Optional api-key for Gemini AI service in case you do not want to use more secure APIM-config
  apiKey: string;
  // Option to enable sharing feature in UI
  sharing: boolean;
  // Option to enable streamed response processing
  streaming: boolean;
  // Option to enable full screen mode
  fullScreen: boolean;
  // Option to enable (external) function calling
  functions: boolean;
  // Option to enable Bing (functions must be enabled)
  bing: boolean;
  // Option to add api-key for Bing service if APIM endpoint is not configured
  apiKeyBing: string;
  // Option to enable Bing (functions must be enabled)
  google: boolean;
  // Option to add api-key for Bing service if APIM endpoint is not configured
  apiKeyGoogle: string;
  // Option to enable image generation
  images: boolean;
  // Option to enable examples for the pronpt text
  examples: boolean;
  // Option to enable voice input to the pronpt text
  voiceInput: boolean;
  // Option to enable voice output for AI-generated text
  voiceOutput: boolean;
  // Option to enable code highlighting
  highlight: boolean;
  // Option to show code highlighting styles (requires highlight == true)
  highlightStyles: boolean;
  // Option for default code highlighting style (requires highlight == true)
  highlightStyleDefault: string;
  // Option to enable storage encryption
  storageEncryption: boolean;
  // Option for various storage types. Default is Database (when empty)
  storageType: StorageType;
  // Option to choose desired location of prompt texarea above or below content panel
  promptAtBottom: boolean;
  // Option to use unlimited chat history length.
  // If it is used, it removes earlier messages from chat's history submitted to AI when its max allowed content length is exceeded.
  unlimitedHistoryLength: boolean;
  // Optional locale to format dates
  locale: string;
}
