export interface AIProvider {
    /**
     * Send a single message and get the full response.
     */
    sendMessage(prompt: string): Promise<string>;
    
    /**
     * Send a message and yield the FULL accumulated response text as it streams.
     * (Yields the complete string from the beginning of the response each time)
     */
    streamMessage(prompt: string): AsyncGenerator<string>;
    
    /**
     * Initialize or start a new conversation context.
     */
    createConversation(): Promise<void>;
    
    /**
     * Clear current conversation.
     */
    resetConversation(): Promise<void>;
    
    /**
     * Check if the provider is ready/connected.
     */
    isConnected(): Promise<boolean>;
}
