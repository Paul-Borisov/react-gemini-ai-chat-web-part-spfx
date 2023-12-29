import * as strings from 'GeminiAiChatWebPartStrings';
import * as React from 'react';
import MessageBar, { MessageType } from 'shared/components/MessageBar/MessageBar';
import { IItemConfig } from 'shared/model/IItemConfig';
import Chat from './Chat';
import { IGeminiAiChatProps } from './IGeminiAiChatProps';

const appNameChatGpt: string = 'ChatGPT';

const GeminiAiChat: React.FunctionComponent<IGeminiAiChatProps> = (props) => {
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [itemConfig, setItemConfig] = React.useState<IItemConfig>(undefined);
  const [isAzureApiServiceConfigured, setIsAzureApiServiceConfigured] = React.useState<boolean>(false);

  const openChat = () => {
    const config: IItemConfig = {
      name: appNameChatGpt,
      description: strings.TextChat,
    };
    setItemConfig(config);
    setIsChatOpen(true);
  };

  React.useEffect(() => {
    if (props.apiService.isConfigured() && !props.apiService.isDisabled()) {
      setIsAzureApiServiceConfigured(true);
      openChat();
    }
  }, [props.apiService.isConfigured(), props.apiService.isDisabled()]);

  return isAzureApiServiceConfigured ? (
    // GeminiAiChatLoader > GeminiAiChat > Chat > ContentPanel > NavigationPanel
    <>{itemConfig && React.createElement(Chat, { config: itemConfig, isOpen: isChatOpen, ...props })}</>
  ) : (
    <MessageBar type={MessageType.error} message={strings.TextUndeterminedError} />
  );
};
export default GeminiAiChat;
