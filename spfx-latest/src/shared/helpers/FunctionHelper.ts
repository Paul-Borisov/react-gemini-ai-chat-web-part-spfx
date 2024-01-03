import GraphQueries from 'shared/constants/GraphQueries';
import SearchResultMapper from 'shared/mappers/SearchResultMapper';
import { IFunctionService } from 'shared/model/IFunctionService';
import { IItemPayload } from 'shared/model/IItemPayload';
import { IODataQuery } from 'shared/model/IODataQuery';
import { FunctionCallingOptions } from 'shared/model/enums/FunctionCallingOptions';
import { FunctionServices } from 'shared/model/enums/FunctionServices';
import AadService from 'shared/services/AadApiService';
import AzureApiService from 'shared/services/AzureApiService';
//import ImageService from 'shared/services/ImageService';
import LogService from 'shared/services/LogService';
import SessionStorageService from 'shared/services/SessionStorageService';
import SharepointService from 'shared/services/SharepointService';

export interface IFunctionCalling {
  id?: string;
  name: string;
  arguments: string;
}

const getCsvContent = (data: any[]): string => {
  const results = SearchResultMapper.mapToCsv(data);
  if (results?.length <= 512 * 1024) {
    // Max allowed CSV-data length to be stored into user's session should not exceed 0.5 MB.
    try {
      SessionStorageService.setData(SessionStorageService.keys.rawResults, results);
    } catch (e) {
      LogService.debug(e);
    }
  }
  return results;
};

// People search: all users with the name Magnus. Roles and emails.
// Get company users that have names starting with P. Format the results as an HTML table. => companyUsers
// SharePoint search: Resource Management System. Format the results as an HTML table. => searchSharepoint
// Search in SharePoint for "Tender Appendix D-Administration Requirements". Format the results as an HTML table. => searchSharepoint
// Search in SharePoint for "Resource Management System". Format the results as an HTML table. => searchSharepoint
// Date and time now => currentDateAndTime, currentDateOrTime
export default class FunctionHelper {
  private available: { [key: string]: any } = {
    currentDateOrTime: this.currentDateOrTime,
    currentDateAndTime: this.currentDateAndTime,
    companyUsers: this.companyUsers,
    peopleSearch: this.companyUsers,
    searchSharepoint: this.searchSharepoint,
    searchOnInternet: this.searchOnInternet,
    searchOnBing: this.searchOnInternet,
    searchOnGoogle: this.searchOnGoogle,
    emptyFunction: this.emptyFunction,
  };

  public async call(allFunctions: IFunctionCalling[], apiService: AzureApiService, payload: IItemPayload): Promise<string[]> {
    if (!allFunctions?.length) return Promise.resolve(undefined);

    const returnValue: string[] = [];
    for (let i = 0; i < allFunctions.length; i++) {
      const functionCalling = allFunctions[i];
      if (functionCalling?.name) {
        const func = this.available[functionCalling.name] ?? this.available['emptyFunction'];
        if (func) {
          let args;
          try {
            args = functionCalling.arguments
              ? JSON.parse(functionCalling.arguments.substring(functionCalling.arguments.lastIndexOf('}{') + 1))
              : {};
          } catch (e) {}

          if (apiService) args = { ...args, apiService: apiService };
          if (payload) args = { ...args, payload: payload };

          returnValue.push(await func(args));
        }
      }
    }
    return Promise.resolve(returnValue);
  }

  public getExtendedMessages(
    json: any,
    messages: any[],
    functionCalling: IFunctionCalling[],
    functionCallingResults: string[]
  ): any[] {
    const extendedMessages = [...messages];

    if (json?.candidates?.length && json.candidates[0].content) {
      extendedMessages.push(json.candidates[0].content);
    } else {
      // TODO: incomplete
      functionCalling.forEach((func) => {
        extendedMessages.push({
          role: 'model',
          parts: [
            {
              functionCall: {
                name: func.name,
                args: typeof func.arguments === 'string' ? JSON.parse(func.arguments) : func.arguments,
              },
            },
          ],
        });
      });
    }

    functionCallingResults.forEach((value, index) => {
      extendedMessages.push({
        role: 'function',
        parts: [
          {
            functionResponse: {
              name: functionCalling[index].name,
              response: {
                name: functionCalling[index].name,
                content: { text: value },
              },
            },
          },
        ],
      });
    });

    return extendedMessages;
  }

  // The stab function, which tries to address halucinations of Gemini AI Beta.
  // Sometimes Gemini AI Beta demands calling a nameless function with empty parameters.
  private async emptyFunction(args: {}): Promise<string> {
    return Promise.resolve('No results.');
  }

  private async companyUsers(args: { myColleagues: boolean }): Promise<string> {
    const query: IODataQuery = args.myColleagues ? GraphQueries.myWorkingWithColleagues : GraphQueries.users;
    let isError: boolean = false;
    const orgPeople = await AadService.getData(query)
      .then((data: any[]) => {
        data = args.myColleagues
          ? data.filter((a) => a.displayName && a.jobTitle)
          : data.filter((a) => a.imAddresses?.length > 0 && a.jobTitle);
        return data
          .sort((a, b) => (a.displayName > b.displayName ? 1 : a.displayName < b.displayName ? -1 : 0))
          .map((person) => {
            const entry = {
              name: person.displayName,
              title: person.jobTitle,
              mail: person.userPrincipalName,
              //id: person.id,
            };
            return entry;
          });
      })
      .catch((error) => {
        isError = true;
        return error;
      });

    const notFound = 'Data not found';
    if (!isError) {
      //return Promise.resolve(JSON.stringify(orgPeople));
      const results = getCsvContent(orgPeople);
      return Promise.resolve(results || notFound);
    } else {
      return Promise.resolve(orgPeople ? JSON.stringify(orgPeople) : notFound);
    }
  }

  private async currentDateAndTime(args: {}, locale: string = 'fi-FI'): Promise<string> {
    const date = new Date();
    return Promise.resolve(
      `${new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date)} ${new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
        .format(date)
        .replace(/\./g, ':')}`
    );
  }

  private async currentDateOrTime(args: { timeNow: boolean }, locale: string = 'fi-FI'): Promise<string> {
    const date = new Date();
    return Promise.resolve(
      args.timeNow
        ? new Intl.DateTimeFormat(locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
            .format(date)
            .replace(/\./g, ':')
        : new Intl.DateTimeFormat(locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }).format(date)
    );
  }

  private async searchSharepoint(args: { queryText: string }): Promise<string> {
    const data = await SharepointService.searchSharepoint(args.queryText, ['Title', 'Author', 'Size', 'Path']);
    const csvResults = getCsvContent(data);

    //return Promise.resolve(JSON.stringify(results));
    return Promise.resolve(csvResults);
  }

  private async searchOnInternet(args: {
    queryText: string;
    apiService: AzureApiService;
    payload: IItemPayload;
  }): Promise<string> {
    const svc = args.payload?.services?.find((s) => s.name === FunctionServices.bing);
    const data = await args.apiService.callBing(args.queryText, svc?.key, args.payload?.model, svc?.locale);

    return Promise.resolve(data);
  }

  private async searchOnGoogle(args: { queryText: string; apiService: AzureApiService; payload: IItemPayload }): Promise<string> {
    const svc = args.payload?.services?.find((s) => s.name === FunctionServices.google);
    const data = await args.apiService.callGoogle(args.queryText, svc?.key, args.payload?.model, svc?.locale);

    return Promise.resolve(data);
  }

  public init(options: FunctionCallingOptions, services: IFunctionService[], tools: any[]): IFunctionCalling[] {
    if (!options || !tools) return undefined;

    const function_declarations = [
      //type: 'function',
      //function:
      {
        name: 'currentDateOrTime',
        description: 'Get current date or time in separate requests',
        parameters: {
          type: 'object',
          properties: {
            timeNow: {
              type: 'boolean',
              description: 'If true then get current time else get current date',
            },
          },
          required: ['timeNow'],
        },
        //},
      },
      {
        //type: 'function',
        //function: {
        name: 'currentDateAndTime',
        description: 'Get current date and time altogether',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        //},
      },
      {
        //type: 'function',
        //function: {
        name: 'companyUsers',
        description: 'Search for company users, employees, people, persons.',
        parameters: {
          type: 'object',
          properties: {
            myColleagues: {
              type: 'boolean',
              description: 'If true then get only my close colleagues else get company users, employees, people, persons.',
            },
          },
          required: ['myColleagues'],
        },
        //},
      },
      {
        //type: 'function',
        //function: {
        name: 'peopleSearch',
        description: 'Search for company users, employees, people, persons.',
        parameters: {
          type: 'object',
          properties: {
            myColleagues: {
              type: 'boolean',
              description: 'If true then get only my close colleagues else get company users, employees, people, persons.',
            },
          },
          required: ['myColleagues'],
        },
        //},
      },
      {
        //type: 'function',
        //function: {
        name: 'searchSharepoint',
        description: 'Get data from SharePoint search API',
        parameters: {
          type: 'object',
          properties: {
            queryText: {
              type: 'string',
              description: 'Text to search data for',
            },
          },
          required: ['queryText'],
        },
        //},
      },
    ];

    if (services?.length) {
      services.forEach((s) => {
        switch (s.name) {
          case FunctionServices.bing: {
            function_declarations.push({
              //type: 'function',
              //function: {
              name: 'searchOnInternet',
              description: 'Perform a search on the internet using the Bing API',
              parameters: {
                type: 'object',
                properties: {
                  queryText: {
                    type: 'string',
                    description: 'Text to search for',
                  },
                },
                required: ['queryText'],
              },
              //},
            });
            break;
          }
          case FunctionServices.google: {
            function_declarations.push({
              //type: 'function',
              //function: {
              name: 'searchOnGoogle',
              description: 'Perform a Google search using the Google API',
              parameters: {
                type: 'object',
                properties: {
                  queryText: {
                    type: 'string',
                    description: 'Text to search for',
                  },
                },
                required: ['queryText'],
              },
              //},
            });
            break;
          }
          case FunctionServices.image: {
            function_declarations.push({
              //type: 'function',
              //function: {
              name: 'generateImage',
              description: 'Generate image using Dalle API',
              parameters: {
                type: 'object',
                properties: {
                  queryText: {
                    type: 'string',
                    description: 'The prompt to generate image for',
                  },
                },
                required: ['queryText'],
              },
              //},
            });
            break;
          }
        }
      });
    }

    tools.push({ function_declarations: function_declarations });

    const functionCalling: IFunctionCalling[] = [];
    return functionCalling;
  }
}
