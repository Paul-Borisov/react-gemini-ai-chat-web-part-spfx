import { IReadonlyTheme } from '@microsoft/sp-component-base';
import { DisplayMode, Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  IPropertyPaneDropdownOption,
  PropertyPaneCheckbox,
  PropertyPaneTextField,
  PropertyPaneDropdown,
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import * as strings from 'GeminiAiChatWebPartStrings';
import GeminiAiChat from 'components/GeminiAiChat';
import { IGeminiAiChatProps } from 'components/IGeminiAiChatProps';
import ChatHelper from 'helpers/ChatHelper';
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { getHighlightStyles } from 'shared/components/CodeHighlighter/CodeHighlighter';
import Placeholder from 'shared/components/Placeholder/Placeholder';
import Application, { StorageType } from 'shared/constants/Application';
import SearchResultMapper from 'shared/mappers/SearchResultMapper';
import { IAzureApiServiceConfig } from 'shared/model/IAzureApiServiceConfig';
import PropertyPaneFieldCustomListUrl, { ListType } from 'shared/propertyPaneFields/PropertyPaneFieldCustomListUrl';
import PropertyPanePasswordField from 'shared/propertyPaneFields/PropertyPanePasswordField';
import AzureApiService from 'shared/services/AzureApiService';
import LogService from 'shared/services/LogService';
import PageContextService from 'shared/services/PageContextService';
import SessionStorageService from 'shared/services/SessionStorageService';
import SharepointService from 'shared/services/SharepointService';

export default class GeminiAiChatLoader extends BaseClientSideWebPart<IGeminiAiChatProps> {
  private apiService: AzureApiService;
  private spService: SharepointService;
  private isDarkTheme: boolean = false;
  private webPartWidth: number;
  private isFullWidth: boolean;

  private isImpersonationRequired(): boolean {
    return (
      this.properties.appId === '00000000-0000-0000-0000-000000000000' &&
      this.apiService.isApiManagementUrl(this.properties.endpointBaseUrl)
    );
  }

  public render(): void {
    if (
      this.displayMode === DisplayMode.Edit ||
      //this.properties.appId === '00000000-0000-0000-0000-000000000000' ||
      !this.properties.endpointBaseUrl ||
      this.isImpersonationRequired()
    ) {
      const element = React.createElement(Placeholder, {
        propertyPane: this.context.propertyPane,
        displayMode: this.displayMode,
        iconText: strings.PlaceholderText,
        description: strings.PlaceholderDescription,
      });
      ReactDom.render(element, this.domElement);
    } else {
      const locale = this.properties.locale || 'fi-FI';
      try {
        const hasComma =
          Intl.NumberFormat(locale)
            .format(1 / 2)
            .toString()
            .indexOf(',') > 0;
        SearchResultMapper.delimiter = hasComma ? ';' : ',';
      } catch (e) {}

      const element: React.ReactElement<IGeminiAiChatProps> = React.createElement(GeminiAiChat, {
        context: this.context,
        apiService: this.apiService,
        spService: this.spService,
        isDarkTheme: this.isDarkTheme,
        isFullWidthColumn: this.isFullWidth,
        webPartWidth: this.webPartWidth,
        appId: this.properties.appId,
        endpointBaseUrl: this.properties.endpointBaseUrl,
        spImageLibraryUrl: this.properties.spImageLibraryUrl || this.spService.imageLibraryUrl,
        spListUrl: this.properties.spListUrl || this.spService.listUrl,
        //apiKey: this.properties.apiKey,
        apiKey: PropertyPanePasswordField.decrypt(this.context, this.properties.apiKey),
        sharing: this.properties.sharing,
        streaming: this.properties.streaming,
        fullScreen: this.properties.fullScreen,
        functions: this.properties.functions,
        bing: this.properties.functions && this.properties.bing,
        apiKeyBing:
          this.properties.functions && this.properties.bing && this.properties.apiKeyBing
            ? PropertyPanePasswordField.decrypt(this.context, this.properties.apiKeyBing)
            : undefined,
        google: this.properties.functions && this.properties.google,
        apiKeyGoogle:
          this.properties.functions && this.properties.google && this.properties.apiKeyGoogle
            ? PropertyPanePasswordField.decrypt(this.context, this.properties.apiKeyGoogle)
            : undefined,
        images: undefined, //this.properties.functions && this.properties.images,
        examples: this.properties.examples,
        voiceInput: this.properties.voiceInput,
        voiceOutput: this.properties.voiceOutput,
        highlight: this.properties.highlight,
        highlightStyles: this.properties.highlightStyles,
        highlightStyleDefault: this.properties.highlightStyleDefault,
        storageEncryption: this.properties.storageEncryption,
        storageType: this.properties.storageType || StorageType.SharePoint,
        promptAtBottom: this.properties.promptAtBottom,
        unlimitedHistoryLength: this.properties.unlimitedHistoryLength,
        locale: locale,
      });
      ReactDom.render(element, this.domElement);
    }
  }

  protected async onInit(): Promise<void> {
    this.webPartWidth = this.domElement.clientWidth;
    this.isFullWidth = this.isFullWidthColumn();
    LogService.init(Application.Name);
    PageContextService.init(this.context as any);
    this.spService = new SharepointService();
    if (this.properties.storageType === StorageType.SharePoint) {
      await this.spService.init(this.properties.spListUrl ? this.properties.spListUrl : undefined);
    }
    SessionStorageService.hasFunctions = this.properties.functions;
    LogService.debug(null, `${this.title} initialized`);

    const getApiServiceConfig = (): IAzureApiServiceConfig => {
      const config: IAzureApiServiceConfig = {
        appId: this.properties.appId,
        endpointBaseUrl: this.properties.endpointBaseUrl,
        apiKey: PropertyPanePasswordField.decrypt(this.context, this.properties.apiKey),
        isDisabled: false || /isdisabled=true/i.test(window.location.search),
      };
      return config;
    };
    const config = getApiServiceConfig();
    //const authenticate: boolean = config.appId !== undefined && config.appId !== null;
    const authenticate: boolean = ![undefined, null, '00000000-0000-0000-0000-000000000000'].some((s) => s === config.appId);
    this.apiService = new AzureApiService();
    return this.apiService.init(config, authenticate).then((isConfigured) => {
      LogService.debug(null, `${AzureApiService.name} configured: ${isConfigured}`);
    });
  }

  private isFullWidthColumn(): boolean {
    let returnValue: boolean = false;
    let element: HTMLElement = this.domElement;
    do {
      element = element.parentElement;
      if (/CanvasZone/i.test(element?.className)) {
        returnValue = /CanvasZone--fullWidth/i.test(element?.className);
        break;
      }
    } while (element);
    return returnValue;
  }

  protected onAfterResize(newWidth: number): void {
    if (newWidth !== this.webPartWidth) {
      this.webPartWidth = newWidth;
      //this.isFullWidth = this.isFullWidthColumn();
      this.render();
    }
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this.isDarkTheme = !!currentTheme.isInverted;
    const { semanticColors } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || null);
    }
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    const optionsForHighlightStyles = getHighlightStyles().map(
      (style) =>
        ({
          key: style,
          text: style,
        } as IPropertyPaneDropdownOption)
    );
    const optionsForStorageType = [
      /*{
        key: StorageType.Database,
        text: strings.FieldLabelStorageTypeDatabase,
      },
      {
        key: StorageType.Local,
        text: strings.FieldLabelStorageTypeLocalStorage,
      },*/
      {
        key: StorageType.SharePoint,
        text: strings.FieldLabelStorageTypeSharePoint,
      },
    ];

    // To suppress the bug with empty aadInfo when the user refreshes the page in the Edit mode
    PageContextService.init(this.context as any);

    return {
      pages: [
        {
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('appId', {
                  label: strings.FieldLabelAppId,
                }),
                PropertyPaneTextField('endpointBaseUrl', {
                  label: strings.FieldLabelendpointBaseUrl,
                }),
                /*this.properties.storageType === StorageType.Database &&
                  PropertyPaneTextField('endpointBaseUrlForChatHistory', {
                    label: strings.FieldLabelEndpointBaseUrlForChatHistory,
                  }),*/
                new PropertyPanePasswordField('apiKey', {
                  disabled: !ChatHelper.hasDirectEndpoints(this.apiService, this.properties),
                  label: strings.FieldLabelApiKey,
                  placeholder: strings.FieldLabelApiKeyPlaceholder,
                  properties: this.properties,
                  wpContext: this.context,
                }),
                PropertyPaneDropdown('storageType', {
                  label: strings.FieldLabelStorageType,
                  options: optionsForStorageType,
                  selectedKey: this.properties.storageType || StorageType.SharePoint,
                }),
                new PropertyPaneFieldCustomListUrl('spListUrl', {
                  label: strings.FieldLabelSharePointListUrl,
                  properties: this.properties,
                  spService: this.spService,
                  disabled: this.properties.storageType !== StorageType.SharePoint,
                  sharing: this.properties.sharing,
                  listType: ListType.CustomList,
                }),
                PropertyPaneCheckbox('storageEncryption', {
                  text: strings.FieldLabelEncryption,
                }),
                PropertyPaneCheckbox('sharing', {
                  text: strings.FieldLabelSharing,
                  //text: `${strings.FieldLabelSharing}${
                  //  this.properties.storageType === StorageType.Local ? ` ${strings.FieldLabelDemoOnly}` : ''
                  //}`,
                }),
                !!false &&
                  PropertyPaneCheckbox('streaming', {
                    text: strings.FieldLabelStreaming,
                  }),
                PropertyPaneCheckbox('fullScreen', {
                  text: strings.FieldLabelFullScreen,
                }),
                PropertyPaneCheckbox('functions', {
                  text: strings.FieldLabelFunctions,
                }),
                this.properties.functions &&
                  PropertyPaneCheckbox('bing', {
                    text: strings.FieldLabelBing,
                  }),
                new PropertyPanePasswordField('apiKeyBing', {
                  disabled: !(this.properties.functions && this.properties.bing),
                  label: strings.FieldLabelBingApiKey,
                  placeholder: strings.FieldLabelBingApiKeyPlaceholder,
                  properties: this.properties,
                  wpContext: this.context,
                }),
                this.properties.functions &&
                  PropertyPaneCheckbox('google', {
                    text: strings.FieldLabelGoogle,
                  }),
                new PropertyPanePasswordField('apiKeyGoogle', {
                  disabled: !(this.properties.functions && this.properties.google),
                  label: `${strings.FieldLabelGoogleApiKey}`,
                  placeholder: strings.FieldLabelBingApiKeyPlaceholder,
                  properties: this.properties,
                  wpContext: this.context,
                }),
                this.properties.functions &&
                  !!false &&
                  PropertyPaneCheckbox('images', {
                    text: this.apiService?.isApiManagementUrl(this.properties?.endpointBaseUrl)
                      ? strings.FieldLabelImagesApim
                      : strings.FieldLabelImages,
                    disabled: true,
                  }),
                new PropertyPaneFieldCustomListUrl('spImageLibraryUrl', {
                  label: strings.FieldLabelSharePointImageLibraryUrl,
                  properties: this.properties,
                  spService: this.spService,
                  //disabled: !(this.properties.functions && this.properties.images),
                  disabled: !this.properties.functions,
                  sharing: this.properties.sharing,
                  listType: ListType.ImageLibrary,
                  placeholder: strings.FieldLabelSharePointImageLibraryUrlPlaceholder,
                }),
                PropertyPaneCheckbox('examples', {
                  text: strings.FieldLabelExamples,
                }),
                PropertyPaneCheckbox('voiceInput', {
                  text: strings.FieldLabelVoiceInput,
                }),
                PropertyPaneCheckbox('voiceOutput', {
                  text: strings.FieldLabelVoiceOutput,
                }),
                PropertyPaneCheckbox('highlight', {
                  text: strings.FieldLabelHighlight,
                }),
                PropertyPaneCheckbox('highlightStyles', {
                  text: strings.FieldLabelHighlightStyles,
                  disabled: !this.properties.highlight,
                }),
                PropertyPaneDropdown('highlightStyleDefault', {
                  label: strings.FieldLabelDefaultStyle,
                  options: optionsForHighlightStyles,
                  selectedKey: this.properties.highlightStyleDefault,
                  disabled: !this.properties.highlight,
                }),
                PropertyPaneCheckbox('promptAtBottom', {
                  text: strings.FieldLabelPromptAtBottom,
                }),
                PropertyPaneCheckbox('unlimitedHistoryLength', {
                  text: strings.FieldLabelUnlimitedHistoryLength,
                }),
                PropertyPaneTextField('locale', {
                  label: strings.FieldLabelLocale,
                }),
              ],
            },
          ],
        },
      ],
    };
  }
}
