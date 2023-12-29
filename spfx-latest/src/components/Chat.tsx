import { FunctionComponent } from 'react';
import * as React from 'react';
import { IItemConfig } from 'shared/model/IItemConfig';
import ContentPanel from './ContentPanel';
import { IGeminiAiChatProps } from './IGeminiAiChatProps';

export interface IChatProps extends IGeminiAiChatProps {
  config: IItemConfig;
  isOpen: boolean;
}

const Chat: FunctionComponent<IChatProps> = (props) => {
  return <ContentPanel props={props} />; // GeminiAiChatLoader > GeminiAiChat > Chat > ContentPanel > NavigationPanel
};

export default Chat;
