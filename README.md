# Gemini AI Chat web part

This is a Gemini AI Chat Web Part for SharePoint Online, offering a user experience that is similar to [Azure OpenAI Chat Web Part](https://github.com/Paul-Borisov/Azure-OpenAI-Chat-Webpart), which I published in November 2023.
- SPFx 1.18, React, Gemini AI Pro / Pro Vision, optional Azure API Management configurations to resolve Gemini AI access restrictions for European locations (as of December 2023).

**Data Privacy**

Gemini AI is the latest and most capable AI model published by Google. Any data provided to endpoints of Gemini AI goes to US service locations. Gemini AI is not yet [GDPR-compliant](https://thenextweb.com/news/google-gemini-ai-unavailable-europe-uk).
- RESTful endpoints of Gemini AI can be accessed using a free API key generated via [Google AI Studio](https://makersuite.google.com/app/apikey).

**Users in Europe and UK.**
As of December 2023, users from European and UK locations do not have direct access to Google AI Studio.
- To obtain the API key from those locations, you can use any VPN service to connect to permitted ones like US.
- To access the endpoints with the API key from restricted locations you should also use a VPN connection, which is not convenient.

This web part supports the default option to interact with **Gemini AI** endpoints published via Azure API Management service instance (APIM), which can be deployed to US zone to suppress location-based access restrictions.

- APIM consistently validates identities of SharePoint users for each individual request. If the request originates from authorized domains, APIM retrieves the **api-key** from the secure vault and injects it into the request before forwarding it to the AI endpoint. This process ensures that the api-key does not get exposed in the browser.
- Chats are private and visible only to their creators. Creators have the option to share their chats when this feature is enabled in the web part settings (disabled by default).
- Creators can share their chats with everyone or only with specific people in the company.

In the simplest case, you can also use direct access to Gemini AI endpoints, configured with an API key explicitly stored in the web part properties.
- **This setup, while the least secure, can provide a quicker start.** It is not recommended for production use, but it can be used for quick tests or in situations where you do not have access to Azure API Management.
- The stored key is encrypted in the web part properties and displayed as \*\*\* in the Property Pane.
  However, it will travel in browser requests and can be viewed within the DEV tools > Network > Request headers.
- If you are located in Europe or UK, you should use a VPN to connect to 

The web part supports optional integrations with company data. For security reasons, these integrations are disabled by default and must be explicitly enabled in the web part settings.

The integrations available in this release include:

- SharePoint Search
- Company Users
- Local Date and Time
- Analysis of an uploaded PDF and summarization of its content
- Analysis of uploaded images and description of their content
- Version 1.1 released on Dec 11, 2023. It includes the following additional options:
  - Search on the Internet: Bing and Google (+ Reddit).
    - The configuration is supported in two alternatives:
      - 1. Using the additional APIM-endpoints https://**tenant**.azure-api.net/**bing** and/or https://**tenant**.azure-api.net/**google**
      - 2. Using the direct Bing and Google endpoints with own **api-key** values stored in the web part settings (less secure).

  - Image generation from the prompt text. This option supports Dalle 3.

    - The configuration is supported in three alternatives:
      - 1. Using the additional APIM-endpoint https://**tenant**.azure-api.net/openai/**dalle**
      - 2. Using the Azure OpenAI endpoint https://**tenant**.openai.azure.com/openai/deployments/dalle3/images/generations?api-version=2023-12-01-preview with **api-key** stored in the web part settings (less secure).
        - The model Dalle3 is available for the deployment in Swedish Central zone (as of December 2023).
      - 3. Using the Native OpenAI endpoint https://**api.openai.com**/v1/images/generations with **api-key** stored in the web part settings (less secure).

  - The option to use voice input to prompt text is available.

- Version 1.2 released on Dec 23, 2023. It includes the following additional options:
  - Data encryption for all storage types.
    - SharePoint list
    - Database
    - Local Storage
    - Seamless support of the Chat Sharing option for all storage types
 
  - GPT-4 Vision APIM endpoint (/openai4/vision).
    
  - Speech synthesis to read out AI-generated texts by default
    - The standard Web Speech API requires selecting the preferred language; using default page language is not always optimal. This default option is used when Native OpenAI text-to-speech model is not available.
    - Azure OpenAI does not yet have support for text-to-speech models (as of Dec 2023).
      
  - /tts APIM endpoint (/openainative/tts) and Native OpenAI text-to-speech model for AI-generated texts.
    - In case of using Native OpenAI endpoints - direct URL or APIM-based operation - the native text-to-speech model automatically handles text that contains mixed languages.
      
### Full-Scale Setup

![Data access diagram](docs/data-access-diagram.png "Data access diagram")
