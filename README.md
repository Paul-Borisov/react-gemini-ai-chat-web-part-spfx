# Gemini AI Chat web part

This is a Gemini AI Chat Web Part for SharePoint Online, offering a user experience that is similar to [Azure OpenAI Chat Web Part](https://github.com/Paul-Borisov/Azure-OpenAI-Chat-Webpart), which I published earlier.
- SPFx 1.18, React, Gemini AI Pro / Pro Vision, optional Azure API Management configurations to resolve Gemini AI access restrictions for European locations (as of December 2023).
- The setup and configurations are similar to Azure OpenAI Chat Web Part.

**Data Privacy**

Gemini AI is the latest and most capable AI model published by Google. Any data provided to endpoints of Gemini AI goes to US service locations. Gemini AI is not yet [GDPR-compliant](https://thenextweb.com/news/google-gemini-ai-unavailable-europe-uk).
- RESTful endpoints of Gemini AI can be accessed using a free API key generated via [Google AI Studio](https://makersuite.google.com/app/apikey).

**Key features**
- Default support of Gemini Pro and Gemini Pro Vision
- Chat history stored into a SharePoint Custom List with the optional data encryption (off by default)
- Integration with Azure API Management Service to provide seamless access from European and UK locations; more details are provided below.
- Global and Private Chat Sharing for selected Azure AD accounts
- Full-Screen Mode
- Code Highlighting with Configurable Styles
- Unlimited Length of Chat History (Configurable)
- Upper and Lower side positioning for the Prompt Text Area
- Analysis of an uploaded PDF and summarization of its content (gemini-pro)
- Analysis of uploaded images and description of their content (gemini-pro-vision)
- Optional dropdown box with examples for prompt text.
- Optional voice input to prompt text.
- Optional speech synthesis to read out AI-generated texts by default. The standard Web Speech API requires selecting the preferred language; using default page language is not always optimal.
- Optional data encryption for Chats data.
- Configurable Formats for Dates: Default is Finnish, which can be changed to "en-US" in Web Part Settings.

**Data integrations**

The web part supports optional integrations with external data using the Function Calling feature of Gemini Pro. These integrations are disabled by default and must be enabled in the web part settings.

The integrations available in the first release include:
- SharePoint Search
- Company Users
- Local Date and Time
- Search on the Internet: Bing and Google (+ Reddit).
  - The configuration is supported in two alternatives:
    - 1. Using the additional APIM-endpoints https://**tenant**.azure-api.net/**bing** and/or https://**tenant**.azure-api.net/**google**
    - 2. Using the direct Bing and Google endpoints with own **api-key** values stored in the web part settings (less secure).

**Users in Europe and UK**

As of December 2023, users from European and UK locations do not have direct access to Google AI Studio.
- To obtain the API key from those locations, you can use any VPN service to connect to permitted ones like US.
- To access the endpoints with the API key from restricted locations you should also use a VPN connection, which is not convenient.

**Configuration**

This web part supports the default option to interact with **Gemini AI** endpoints published via Azure API Management service instance (APIM)
- This instance can be deployed to US zone to suppress location-based access restrictions.
- APIM consistently validates identities of SharePoint users for each individual request. If the request originates from authorized domains, APIM retrieves the **api-key** from the secure vault and injects it into the request before forwarding it to the AI endpoint. This process ensures that the api-key does not get exposed in the browser.

To configure the storage use the web part properties and

- Click on the Create button under SharePoint list URL
- Click on the Create button under Image library URL

Chats are private and visible only to their creators. Creators have the option to share their chats when this feature is enabled in the web part settings (disabled by default).
- Creators can share their chats with everyone or only with specific people in the company.

In the simplest case, you can also use direct access to Gemini AI endpoints, configured with an API key explicitly stored in the web part properties.
- Base URL for Gemini AI: https://generativelanguage.googleapis.com/v1beta
- **This setup, while the least secure, can provide a quicker start.** It is not recommended for production use, but it can be used for quick tests or in situations where you do not have access to Azure API Management.
- The stored key is encrypted in the web part properties and displayed as \*\*\* in the Property Pane.
  However, it will travel in browser requests and can be viewed within the DEV tools > Network > Request headers.
- If you are located in Europe or UK, you should use a VPN to connect to Gemini AI endpoints in this setup.
