import { fetchEventSource } from '@microsoft/fetch-event-source';
import { AadHttpClient, AadTokenProvider, HttpClient, HttpClientResponse, IHttpClientOptions } from '@microsoft/sp-http';
import { GeminiModels, GeminiModelTokenLimits } from 'shared/constants/Application';
import FunctionHelper from 'shared/helpers/FunctionHelper';
import HtmlHelper from 'shared/helpers/HtmlHelper';
import AzureServiceResponseMapper from 'shared/mappers/AzureServiceResponseMapper';
import { mapResponseData } from 'shared/mappers/ChatMessageMapper';
import SearchResultMapper from 'shared/mappers/SearchResultMapper';
import { IAzureApiServiceConfig } from 'shared/model/IAzureApiServiceConfig';
import { IChatHistory, IChatMessage } from 'shared/model/IChat';
import { IItemPayload } from 'shared/model/IItemPayload';
import LogService from 'shared/services/LogService';
import AadApiService from './AadApiService';
import PageContextService from './PageContextService';
import SessionStorageService from './SessionStorageService';

enum Operations {
  // These operations with sub-URLs must be configured in APIM below APIM > GeminiAI > All operations.
  StandardTextModel = '/chat', // Gemini Pro-turbo (URL reads as https://customer.azure-api.net/geminiai/chat)
  StandardTextModelStream = '/chatstream', // Gemini Pro-turbo (URL reads as https://customer.azure-api.net/geminiai/chatstream)
  StandardTextModelVision = '/vision', // gpt-4-vision-preview (URL reads as https://customer.azure-api.net/geminiai/vision)
  // This operation must be configured in APIM below APIM > Bing > All operations.
  BingSearch = '/bing/search',
  // This operation must be configured in APIM below APIM > Google > All operations.
  GoogleSearch = '/google/search',
  // These operations with sub-URLs can be optionally configured in APIM below APIM > ChatWebApi > All operations.
  ChatMessageLoadHistory = '/api/chatmessage/list',
  ChatMessageLoadHistoryShared = '/api/chatmessage/list/shared',
  ChatMessageCreate = '/api/chatmessage',
  ChatMessageUpdate = ChatMessageCreate,
  ChatMessageDelete = ChatMessageCreate,
}

export default class AzureApiService {
  private config: IAzureApiServiceConfig = undefined;
  private aadClient: AadHttpClient = undefined;
  private authenticate: boolean = true;

  public async init(config: IAzureApiServiceConfig, authenticate: boolean = true): Promise<boolean> {
    this.config = config;
    if (!authenticate) {
      this.authenticate = false;
      return this.isConfigured();
    } else {
      if (this.aadClient && (this.aadClient as any)._resourceUrl === config.appId) {
        //LogService.info(null, (this.aadClient as any)._resourceUrl);
        return true;
      }
      try {
        this.aadClient = await AadApiService.getClientForAzureApp(config.appId);
        //LogService.info(null, 'config.appId', config.appId);
        //LogService.info(null, 'this.aadClient', this.aadClient);
      } catch (e) {
        LogService.error(null, 'GeminiAI not configured: resource (appId) is not valid', config.appId);
      }
      if (this.isConfigured()) {
        return true;
      } else {
        LogService.info(null, 'GeminiAI not configured: check values for appId, endpointBaseUrl');
        return false;
      }
    }
  }

  public getConfig(): IAzureApiServiceConfig {
    return this.config;
  }

  public getAadClient(): AadHttpClient {
    return this.aadClient;
  }

  public isConfigured(): boolean {
    return (this.authenticate ? this.aadClient !== undefined : true) && this.config?.endpointBaseUrl !== undefined;
  }

  public isDisabled(): boolean {
    return this.config?.isDisabled;
  }

  // Checks for a proxy URL of Azure API Management service.
  public isApiManagementUrl(url: string): boolean {
    return /\.azure-api\.net/i.test(url);
  }

  // Checks for an explicit URL of Gemini AI service (which can be used instead of APIM-published one).
  public isGeminiServiceUrl(url: string): boolean {
    return /generativelanguage\.googleapis\.com/i.test(url);
  }

  public async callQueryText(
    payload: IItemPayload,
    stream?: boolean,
    stopSignal?: AbortController,
    callback?: (message: any, done?: boolean, isError?: boolean) => void,
    extendedMessages?: any[]
  ): Promise<string | undefined> {
    const commonParameters = {
      //The temperature controls the degree of randomness in token selection.
      //The temperature is used for sampling during response generation, which occurs when topP and topK are applied.
      //Lower temperatures are good for prompts that require a more deterministic or less open-ended response,
      //while higher temperatures can lead to more diverse or creative results. A temperature of 0 is deterministic,
      //meaning that the highest probability response is always selected.
      temperature: 0.8,
      //The topK parameter changes how the model selects tokens for output. A topK of 1 means the selected token
      //is the most probable among all the tokens in the model's vocabulary (also called greedy decoding),
      //while a topK of 3 means that the next token is selected from among the 3 most probable using the temperature.
      //For each token selection step, the topK tokens with the highest probabilities are sampled.
      //Tokens are then further filtered based on topP with the final token selected using temperature sampling.
      topK: 1,
      //The topP parameter changes how the model selects tokens for output. Tokens are selected from the most to least probable
      //until the sum of their probabilities equals the topP value. For example, if tokens A, B, and C have a probability
      //of 0.3, 0.2, and 0.1 and the topP value is 0.5, then the model will select either A or B as the next token by using
      //the temperature and exclude C as a candidate. The default topP value is 0.95.
      topP: 1,
      //maxOutputTokens specifies the maximum number of tokens that can be generated in the response.
      //A token is approximately four characters. 100 tokens correspond to roughly 60-80 words.
      maxOutputTokens: payload.maxTokens || 2048,
      //stopSequences set a stop sequence to tell the model to stop generating content. A stop sequence can be any sequence of characters.
      // Try to avoid using a sequence of characters that may appear in the generated content.
      stopSequences: [],
    };

    // You can use direct calls to Gemini AI instead of APIM
    const isPro: boolean = !payload.images?.length;
    const isVision: boolean = payload.images?.length > 0;
    const isApiManagementUrl = this.isApiManagementUrl(this.config.endpointBaseUrl);
    const isGeminiServiceUrl = this.isGeminiServiceUrl(this.config.endpointBaseUrl);

    if (isVision) {
      commonParameters.maxOutputTokens = GeminiModelTokenLimits[GeminiModels.Vision];
      commonParameters.temperature = 0.4;
      commonParameters.topK = 32;
    }

    const getEndpointUrl = (baseUrl: string): string => {
      let targetUrl: string;
      if (isGeminiServiceUrl) {
        // Full endpoint URL like https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision
        targetUrl = `${baseUrl}/models/gemini-pro${isVision ? '-vision' : ''}:${
          stream ? 'streamGenerateContent' : 'generateContent'
        }`;
      } else if (isApiManagementUrl) {
        targetUrl = `${
          baseUrl +
          (isVision
            ? Operations.StandardTextModelVision
            : stream
            ? Operations.StandardTextModelStream
            : Operations.StandardTextModel)
        }`;
      }
      return targetUrl;
    };
    const endpointUri =
      getEndpointUrl(this.config.endpointBaseUrl?.trim().replace(/\/+$/, '')) +
      (isGeminiServiceUrl && this.config.apiKey ? `?${stream ? 'alt=sse&' : ''}key=${this.config.apiKey}` : '');

    const messages = extendedMessages ? extendedMessages : [];
    if (!messages.length) {
      if (!isVision) {
        if (payload.chatHistory?.length > 0)
          messages.push(
            ...payload.chatHistory.map((entry: IChatHistory) => {
              return {
                role: entry.role === 'assistant' || entry.role === 'system' ? 'model' : 'user',
                parts: [{ text: entry.content }],
              };
            })
          );
        messages.push({ role: 'user', parts: [{ text: HtmlHelper.htmlEncode(payload.queryText) }] });
      } else {
        messages.push({
          role: 'user',
          parts: [
            {
              text: HtmlHelper.htmlEncode(payload.queryText),
            },
            ...payload.images.map((url) => ({
              inlineData: {
                mimeType: 'image/png',
                data: /^data:/i.test(url) ? url.substring(url.indexOf(',') + 1) : url,
              },
            })),
          ],
        });
      }
    }

    const functionCaller = !isVision ? new FunctionHelper() : undefined;
    const tools = [];
    const functionCalling = functionCaller ? functionCaller.init(payload.functions, payload.services, tools) : undefined;

    const bodyParts = {
      contents: messages,
      generationConfig: commonParameters,
    };
    if (tools.length) {
      bodyParts['tools'] = tools;
    }
    const body = JSON.stringify(bodyParts);

    if (!extendedMessages) SessionStorageService.clearRawResults();
    if (!extendedMessages) AzureServiceResponseMapper.clearErrorDetails();

    if (!stream) {
      const requestHeaders: Headers = new Headers();
      requestHeaders.append('content-type', 'application/json');

      const postOptions: IHttpClientOptions = {
        headers: requestHeaders,
        //body: JSON.stringify([{ Text: text.length > 5000 ? text.substring(0, 5000) : text }]),
        body: body,
      };

      let response: HttpClientResponse = undefined;
      try {
        if (this.authenticate && isApiManagementUrl) {
          response = await this.aadClient.post(endpointUri, AadHttpClient.configurations.v1, postOptions);
        } else {
          response = await PageContextService.context.httpClient.post(endpointUri, HttpClient.configurations.v1, postOptions);
        }
      } catch (e) {
        LogService.error(e);
        return undefined;
      }

      if (response.ok) {
        const json = await response.json();

        if (functionCalling) {
          // If this option enabled.
          AzureServiceResponseMapper.mapToFunctionCalling(json, functionCalling, stream);
          if (functionCalling.length) {
            // If AI requested function calling.
            const functionCallingResults = await functionCaller.call(functionCalling, this, payload);
            //console.log(functionCallingResults);
            if (functionCallingResults.length > 0) {
              if (/^<img /i.test(functionCallingResults[0])) {
                // The response starts with a generated image
                return functionCallingResults[0];
              } else if (functionCallingResults[0] === undefined) {
                // Error occured (with details saved and available)
                return undefined;
              }
            }
            const newMessages = functionCaller.getExtendedMessages(json, messages, functionCalling, functionCallingResults);
            return await this.callQueryText(payload, stream, stopSignal, callback, newMessages);
          } else {
            return HtmlHelper.htmlDecode(AzureServiceResponseMapper.mapResponseQueryText(json));
          }
        } else {
          return HtmlHelper.htmlDecode(AzureServiceResponseMapper.mapResponseQueryText(json));
        }
      } else {
        const error = await response.text();
        LogService.error(error);
        AzureServiceResponseMapper.saveErrorDetails(error);
        return undefined;
      }
    } else {
      const requestHeaders = {
        accept: 'text/event-stream',
        'content-type': 'application/json',
      };
      if (this.authenticate && isApiManagementUrl) {
        const aadToken = await PageContextService.context.aadTokenProviderFactory
          .getTokenProvider()
          .then((tokenProvider: AadTokenProvider): Promise<string> => {
            return tokenProvider.getToken(this.config.appId);
          });
        requestHeaders['Authorization'] = `Bearer ${aadToken}`;
      }

      const onMessage = (event) => {
        //console.log(event);
        if (!event.data || /\[done\]/i.test(event.data)) return;
        //console.log(event.data);
        const json = JSON.parse(event.data);
        AzureServiceResponseMapper.mapToFunctionCalling(json, functionCalling, stream);
        const text = HtmlHelper.htmlDecode(AzureServiceResponseMapper.mapResponseQueryText(json) || '');
        if (text && callback) {
          callback(text);
        }
      };

      const maxErrors = 1;
      let errorCounter = 0;
      try {
        fetchEventSource(endpointUri, {
          method: 'POST',
          headers: requestHeaders as any,
          body: body,
          onmessage: onMessage,
          onopen: async (response) => {
            LogService.debug(null, 'Connection opened');
            if (!response.ok) {
              try {
                response.text().then((error: string) => AzureServiceResponseMapper.saveErrorDetails(error));
              } catch (e) {}
            }
          },
          onclose: async () => {
            LogService.debug(null, 'Connection closed');
            if (functionCalling?.length) {
              const functionCallingResults = await functionCaller.call(functionCalling, this, payload);
              //console.log(functionCallingResults);
              if (functionCallingResults.length > 0) {
                if (/^<img /i.test(functionCallingResults[0])) {
                  // The response starts with a generated image
                  callback(functionCallingResults[0]);
                  callback('', true);
                  return;
                } else if (functionCallingResults[0] === undefined) {
                  // Error occured (with details saved and available)
                  callback('', true);
                  return;
                }
              }
              const newMessages = functionCaller.getExtendedMessages(
                undefined,
                messages,
                functionCalling,
                functionCallingResults
              );
              this.callQueryText(payload, stream, stopSignal, callback, newMessages);
              //if (functionCallingResults && callback) callback(functionCallingResults);
            } else if (callback) {
              callback('', true);
            }
          },
          onerror: (error) => {
            //functionCalling.name = '';
            //functionCalling.arguments = '';
            LogService.error(error);
            if (callback) callback('', false, true);
            errorCounter++;
            if (errorCounter > maxErrors) throw 'Too many errors; disconnected.';
          },
          signal: stopSignal.signal,
        });
      } catch (e) {
        LogService.error(e);
        return undefined;
      }
    }
  }

  public async loadChatHistory(callback: (data: IChatMessage[]) => void, shared?: boolean) {
    const endpointUri: string = !shared
      ? `${this.config.endpointBaseUrlForWebApi}${Operations.ChatMessageLoadHistory}/${
          //PageContextService.context.pageContext.user.loginName
          PageContextService.context.pageContext.aadInfo.userId.toString() // ObjectID is more secure
        }`
      : `${this.config.endpointBaseUrlForWebApi}${Operations.ChatMessageLoadHistoryShared}`;

    let response: HttpClientResponse = undefined;
    try {
      if (this.authenticate) {
        response = await this.aadClient.get(endpointUri, AadHttpClient.configurations.v1);
      } else {
        response = await PageContextService.context.httpClient.get(endpointUri, HttpClient.configurations.v1);
      }
    } catch (e) {
      LogService.error(e);
      return undefined;
    }

    if (response.ok) {
      const json = await response.json();
      //console.log(AzureServiceResultMapper.mapResponseQueryText(json));
      //return HtmlHelper.htmlDecode(AzureServiceResponseMapper.mapResponseQueryText(json));
      callback(mapResponseData(json));
    } else {
      const error = await response.text();
      LogService.error(error);
    }
  }

  public async deleteChat(id: string, callback: () => void) {
    const endpointUri: string = `${this.config.endpointBaseUrlForWebApi}${Operations.ChatMessageDelete}/${id}`;

    let response: HttpClientResponse = undefined;
    try {
      if (this.authenticate) {
        response = await this.aadClient.fetch(endpointUri, AadHttpClient.configurations.v1, { method: 'DELETE' });
      } else {
        response = await PageContextService.context.httpClient.fetch(endpointUri, HttpClient.configurations.v1, {
          method: 'DELETE',
        });
      }
    } catch (e) {
      LogService.error(e);
      return undefined;
    }

    if (response.ok) {
      callback();
    } else {
      const error = await response.text();
      LogService.error(error);
    }
  }

  public async createChat(
    newChatName: string,
    newChatHistory: IChatHistory[] | string,
    callback: (newChatGuid: string) => void,
    displayName?: string
  ) {
    const endpointUri: string = `${this.config.endpointBaseUrlForWebApi}${Operations.ChatMessageCreate}`;

    const newChatGuid = (crypto as any).randomUUID();
    const payload = {
      id: newChatGuid,
      name: newChatName,
      //username: PageContextService.context.pageContext.user.loginName,
      username: PageContextService.context.pageContext.aadInfo.userId.toString(), // ObjectID is more secure
      message: typeof newChatHistory !== 'string' ? JSON.stringify(newChatHistory) : newChatHistory,
      displayName: displayName === undefined ? PageContextService.context.pageContext.user.displayName : displayName,
    };

    const options: IHttpClientOptions = {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    };
    let response: HttpClientResponse = undefined;
    try {
      if (this.authenticate) {
        response = await this.aadClient.post(endpointUri, AadHttpClient.configurations.v1, options);
      } else {
        response = await PageContextService.context.httpClient.post(endpointUri, HttpClient.configurations.v1, options);
      }
    } catch (e) {
      LogService.error(e);
      return undefined;
    }

    if (response.ok) {
      callback(newChatGuid);
    } else {
      const error = await response.text();
      LogService.error(error);
    }
  }

  private async updateChat(id: string, payload: any, callback: () => void) {
    const endpointUri: string = `${this.config.endpointBaseUrlForWebApi}${Operations.ChatMessageUpdate}/${id}`;

    const options: IHttpClientOptions = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    };
    let response: HttpClientResponse = undefined;
    try {
      if (this.authenticate) {
        response = await this.aadClient.fetch(endpointUri, AadHttpClient.configurations.v1, options);
      } else {
        response = await PageContextService.context.httpClient.fetch(endpointUri, HttpClient.configurations.v1, options);
      }
    } catch (e) {
      LogService.error(e);
      return undefined;
    }

    if (response.ok) {
      if (callback) callback();
    } else {
      const error = await response.text();
      LogService.error(error);
    }
  }

  public async updateChatHistory(id: string, newChatHistory: IChatHistory[] | string, callback: () => void, modified?: string) {
    const payload = {
      message: typeof newChatHistory !== 'string' ? JSON.stringify(newChatHistory) : newChatHistory,
      modified: modified,
    };
    this.updateChat(id, payload, callback);
  }

  public async updateChatName(id: string, newChatHName: string, modified: string, callback: () => void) {
    const payload = {
      name: newChatHName,
    };
    this.updateChat(id, payload, callback);
  }

  public async shareChat(id: string, share: boolean, shareWith: string[], modified: string, callback: () => void) {
    const payload = {
      shared: !!share,
      sharedWith: shareWith?.join(';'),
    };
    this.updateChat(id, payload, callback);
  }

  public async clearDisplayName(id: string) {
    const payload = {
      displayname: '',
    };
    this.updateChat(id, payload, undefined);
  }

  public async callBing(queryText: string, apiKey: string, model: string, market: string = 'en-US'): Promise<string> {
    const serviceUri = 'https://api.bing.microsoft.com';

    let endpointUri: string;
    if (apiKey) {
      endpointUri = `${serviceUri}/v7.0/search?q=${encodeURIComponent(queryText)}&mkt=${market}`;
    } else if (this.isApiManagementUrl(this.config.endpointBaseUrl)) {
      endpointUri = `${new URL(this.config.endpointBaseUrl).origin}${Operations.BingSearch}?q=${encodeURIComponent(
        queryText
      )}&mkt=${market}`;
    } else if (this.isApiManagementUrl(this.config.endpointBaseUrl4)) {
      endpointUri = `${new URL(this.config.endpointBaseUrl4).origin}${Operations.BingSearch}?q=${encodeURIComponent(
        queryText
      )}&mkt=${market}`;
    } else {
      LogService.error(
        `Preconfigured APIM URL is required to call the Bing endpoint (or an API Key for calling the endpoint at ${serviceUri})`
      );
      return Promise.resolve('');
    }

    let response: HttpClientResponse = undefined;
    try {
      let executed = false;
      if (this.authenticate) {
        if (!apiKey) {
          executed = true;
          response = await this.aadClient.get(endpointUri, AadHttpClient.configurations.v1);
        }
      }
      if (!executed) {
        const requestHeaders: Headers = new Headers();
        if (apiKey) requestHeaders.append('Ocp-Apim-Subscription-Key', apiKey);

        const options: IHttpClientOptions = {
          headers: requestHeaders,
        };
        response = await PageContextService.context.httpClient.get(endpointUri, HttpClient.configurations.v1, options);
      }
    } catch (e) {
      LogService.error(e);
      return Promise.resolve('');
    }

    if (response.ok) {
      const json = await response.json();
      const keys = /gpt-(4|5|6)-(512k|256k|128k|64k|32k|1106|turbo)/i.test(model)
        ? ['news', 'webPages', 'relatedSearches', 'images', 'videos']
        : /-16k/i.test(model)
        ? ['news', 'webPages', 'relatedSearches']
        : ['news'];

      const results = SearchResultMapper.mapSearchResultsOfBing(json, keys);
      return Promise.resolve(JSON.stringify(results));
    } else {
      const error = await response.text();
      LogService.error(error);
      AzureServiceResponseMapper.saveErrorDetails(error);
      return Promise.resolve('');
    }
  }

  public async callGoogle(queryText: string, apiKey: string, model: string, market: string = 'en-US'): Promise<string> {
    const serviceUri = 'https://www.googleapis.com';

    let endpointUri: string;
    if (apiKey) {
      endpointUri = `${serviceUri}/customsearch/v1?${apiKey + '&'}q=${encodeURIComponent(queryText)}&lr=${market}`;
    } else if (this.isApiManagementUrl(this.config.endpointBaseUrl)) {
      endpointUri = `${new URL(this.config.endpointBaseUrl).origin}${Operations.GoogleSearch}?q=${encodeURIComponent(
        queryText
      )}&lr=${market}`;
    } else if (this.isApiManagementUrl(this.config.endpointBaseUrl4)) {
      endpointUri = `${new URL(this.config.endpointBaseUrl4).origin}${Operations.GoogleSearch}?q=${encodeURIComponent(
        queryText
      )}&lr=${market}`;
    } else {
      LogService.error(
        `Preconfigured APIM URL is required to call the Google endpoint (or an API Key in the format key=...&cx=... for calling the endpoint at ${serviceUri})`
      );
      return Promise.resolve('');
    }

    let response: HttpClientResponse = undefined;
    try {
      let executed = false;
      if (this.authenticate) {
        if (!apiKey) {
          executed = true;
          response = await this.aadClient.get(endpointUri, AadHttpClient.configurations.v1);
        }
      }
      if (!executed) {
        response = await PageContextService.context.httpClient.get(endpointUri, HttpClient.configurations.v1);
      }
    } catch (e) {
      LogService.error(e);
      return Promise.resolve('');
    }

    if (response.ok) {
      const json = await response.json();
      const keys = /gpt-(4|5|6)-(512k|256k|128k|64k|32k|1106|turbo)/i.test(model)
        ? ['title', 'link', 'displayLink', 'snippet', 'pagemap.metatags', 'pagemap.cse_image']
        : /-16k/i.test(model)
        ? ['title', 'link', 'displayLink']
        : ['title', 'link'];
      const results = SearchResultMapper.mapCustomSearchResultsOfGoogle(json, keys);
      return Promise.resolve(JSON.stringify(results));
    } else {
      const error = await response.text();
      LogService.error(error);
      AzureServiceResponseMapper.saveErrorDetails(error);
      return Promise.resolve('');
    }
  }
}
