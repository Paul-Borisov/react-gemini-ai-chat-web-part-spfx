import { IFunctionCalling } from 'shared/helpers/FunctionHelper';
import SessionStorageService from 'shared/services/SessionStorageService';

// Maps Gemini AI service response to results
export default class AzureServiceResponseMapper {
  public static mapResponseQueryImage(data: any): string[] {
    const results = data?.result?.data;
    if (results?.length === 1) {
      return [results[0].url];
    } else if (results?.length > 1) {
      return results.map((r) => r.url);
    } else {
      return undefined;
    }
  }

  public static mapResponseQueryText(data: any): string {
    const texts: string = data?.candidates?.map((candidate) => candidate.content?.parts.map((part) => part.text));
    return !texts || texts.length === 0 ? undefined : texts.length === 1 ? texts[0] : JSON.stringify(texts);
  }

  public static mapToFunctionCalling(data: any, functionCalling: IFunctionCalling[], isStreaming: boolean) {
    if (!data || !functionCalling || !data.candidates?.length) return;

    const allIds = [];
    const allFunctions = [];
    if (
      data.candidates?.length > 0 &&
      data.candidates[0].content?.parts?.length > 0 &&
      data.candidates[0].content.parts[0].functionCall
    ) {
      allFunctions.push(...data.candidates[0].content.parts.map((part) => part.functionCall).filter((f) => f));
    }
    for (let i = 0; i < allFunctions.length; i++) {
      const id = allIds.length > i ? allIds[i] : undefined;
      const func = allFunctions[i];
      if (func) {
        let singleFunction: IFunctionCalling;
        if (func.name || functionCalling.length === 0) {
          singleFunction = { id: id, name: func.name ?? 'emptyFunction', arguments: '' };
          functionCalling.push(singleFunction);
        } else {
          singleFunction = functionCalling[functionCalling.length - 1];
        }
        const args = func.args || func.arguments;
        if (args) {
          singleFunction.arguments = (singleFunction.arguments ?? '') + JSON.stringify(args);
        }
      }
    }
  }

  public static clearErrorDetails() {
    SessionStorageService.clearData(SessionStorageService.keys.errorDetails);
  }

  public static saveErrorDetails(errorDetails: string) {
    if (!errorDetails) return;

    let message = errorDetails;
    // Use case 1: {"error":{"message":"Error message 1"}}
    // Use case 2: {"odata.error":{"code":"-1, System.ArgumentException","message":{"lang":"en-US","value":"Error message 2"}}}
    // TODO: redesign in a better way...
    const searchFor = [/"message":\s?"([^"]+)"/i, /"value":\s?"([^"]+)"/i];
    try {
      for (let i = 0; i < searchFor.length; i++) {
        const re = searchFor[i];
        if (re.test(errorDetails)) {
          const errorMessage = errorDetails.match(re)[1];
          if (errorMessage) {
            message = errorMessage;
            break;
          }
        }
      }
    } catch (e) {}
    SessionStorageService.setData(SessionStorageService.keys.errorDetails, message);
  }
}
