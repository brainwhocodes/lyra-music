import type { MessageType } from './message-type';

export interface NotificationMessage {
    message: string;
    type: MessageType;
    visible: boolean;
}