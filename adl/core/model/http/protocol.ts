import { SourceFile, TypeAliasDeclaration } from 'ts-morph';
import { hasTag } from '../../support/doc-tag';
import { Alias } from '../alias';
import { ApiModel, isOperationGroupInterfaceType, isResponseCollectionTypeAlias, isResponseTypeAlias, isResultInterfaceType, isResultTypeAlias } from '../api-model';
import { Element } from '../element';
import { Protocol } from '../project/protocol';
import { Declaration } from '../typescript/reference';
import { Header } from './header';
import { OperationGroup, ResponseCollection } from './operation';
import { Parameter } from './parameter';
import { Response, Result } from './response';

export enum AuthenticationType {
  ApiKey = 'apikey',
  Http = 'http',
  OAuth2 = 'oauth2',
  OpenIdConnect = 'openidconnect'
}

export enum ParameterLocation {
  Query = 'query',
  Header = 'header',
  Cookie = 'cookie',
}

export class AuthenticationRequirement extends Element {
  /** List of authentications that must all be satisfied. */
  authentications = new Array<AuthenticationReference>();
}

export class AuthenticationReference extends Element {
  /** The scopes of the authentication being referenced. Can only be non-empty if the referenced authentication is OAuth2. */
  scopes = new Array<string>();

  constructor(public authentication: Authentication | Alias<Authentication>, initializer?: Partial<AuthenticationRequirement>) {
    super();
    this.initialize(initializer);
  }
}

export type Authentication = ApiKeyAuthentication | HttpAuthentication | OAuth2Authentication | OpenIdConnectAuthentication;

export abstract class AuthenticationBase extends Element {
  /** The authentication type.  */
  readonly abstract type: AuthenticationType;

  /** A short description for the authentication. */
  description?: string;

  /** Unique identifier for this authentication in the model. */
  readonly abstract name: string;
}

export class ApiKeyAuthentication extends AuthenticationBase {
  readonly type = AuthenticationType.ApiKey;

  /**
   * @param name Unique identifier for this authentication in the model.
   * @param parameterName The name of the header, query or cookie parameter to be used.
   * @param parameterLocation The location of the API key.
   */
  constructor(public name: string, public parameterName: string, public parameterLocation: ParameterLocation, initializer?: Partial<ApiKeyAuthentication>) {
    super();
    this.initialize(initializer);
  }
}

export class HttpAuthentication extends AuthenticationBase {
  readonly type = AuthenticationType.Http;
  bearerFormat?: string;

  /**
   * @param scheme The name of the HTTP Authorization scheme to be used in the Authorization header as defined in RFC7235.
   */
  constructor(public name: string, public scheme: string, initializer?: Partial<HttpAuthentication>) {
    super();
    this.initialize(initializer);
  }
}

export class OAuth2Authentication extends AuthenticationBase {
  readonly type = AuthenticationType.OAuth2;

  constructor(public name: string, public flows: OAuth2Flows, initializer?: Partial<OAuth2Authentication>) {
    super();
    this.initialize(initializer);
  }
}

export class OpenIdConnectAuthentication extends AuthenticationBase {
  readonly type = AuthenticationType.OpenIdConnect;

  /**
   * @param openIdConnectUrl Connect URL to discover OAuth2 configuration values.
   * */
  constructor(public name: string, public openIdConnectUrl: string, initializer?: Partial<OpenIdConnectAuthentication>) {
    super();
    this.initialize(initializer);
  }
}

export class OAuth2Flows extends Element {
  /** Configuration for the OAuth Implicit flow */
  implicit?: ImplicitOAuth2Flow;

  /** Configuration for the OAuth Resource Owner Password flow */
  password?: PasswordOAuth2Flow;

  /** Configuration for the OAuth Client Credentials flow. Previously called application in OpenAPI 2.0. */
  clientCredentials?: ClientCredentialsOAuth2Flow;

  /** Configuration for the OAuth Authorization Code flow. Previously called accessCode in OpenAPI 2.0. */
  authorizationCode?: AuthorizationCodeOAuth2Flow;

  constructor(initializer?: Partial<OAuth2Flows>) {
    super();
    this.initialize(initializer);
  }
}

export abstract class OAuth2Flow extends Element {
  /** The URL to be used for obtaining refresh tokens. */
  refreshUrl?: string;

  /** The available scopes for the OAuth2 authentication. */
  scopes = new Array<OAuth2Scope>();
}

export class ClientCredentialsOAuth2Flow extends OAuth2Flow {
  /**
   * @param tokenUrl The token URL to be used for this flow.
   */
  constructor(public tokenUrl: string, initializer?: Partial<ClientCredentialsOAuth2Flow>) {
    super();
    this.initialize(initializer);
  }
}

export class PasswordOAuth2Flow extends OAuth2Flow {
  /**
   * @param tokenUrl The token URL to be used for this flow.
   */
  constructor(public tokenUrl: string, initializer?: Partial<PasswordOAuth2Flow>) {
    super();
    this.initialize(initializer);
  }
}

export class ImplicitOAuth2Flow extends OAuth2Flow {
  /**
   * @param authorizationUrl The authorization URL to be used for this flow. This MUST be in the form of a URL.
   */
  constructor(public authorizationUrl: string, initializer?: Partial<ImplicitOAuth2Flow>) {
    super();
    this.initialize(initializer);
  }
}

export class AuthorizationCodeOAuth2Flow extends OAuth2Flow {
  /**
   * @param authorizationUrl The authorization URL to be used for this flow. This MUST be in the form of a URL.
   * @param tokenUrl The token URL to be used for this flow.
   */
  constructor(public authorizationUrl: string, public tokenUrl: string, initializer?: Partial<AuthorizationCodeOAuth2Flow>) {
    super();
    this.initialize(initializer);
  }
}

export class OAuth2Scope extends Element {
  constructor(public name: string, public description: string, initializer?: Partial<OAuth2Scope>) {
    super();
    this.initialize(initializer);
  }
}

export class Connection extends Element {
  description?: string;
  variables = new Array<ConnectionVariable>();

  constructor(public url: string, initializer?: Partial<Connection>) {
    super();
    this.initialize(initializer);
  }
}

// Consider modeling this as a Parameter once that's fleshed out?
export class ConnectionVariable extends Element {
  /** A description of the variable. */
  description?: string;

  /** The default value to use when substituting the variable in the connection URL. */
  defaultValue?: string;

  /**
   * When defined, any string value may substitute the variable.
   * Otherwise, only values in this array may do so.
   */
  allowedValues?: Array<string>;

  /**
   * @param name The name of the variable as it appears in {curly braces} in the connection URL.
   */
  constructor(public name: string, initializer?: Partial<ConnectionVariable>) {
    super();
    this.initialize(initializer);
  }
}

function isHeader(declaration: TypeAliasDeclaration) {
  if (hasTag(declaration, 'header')) {
    return true;
  }
  return false;
}

function isParameterTypeAlias(declaration: TypeAliasDeclaration) {
  // check for query,header,cookie,body
  return false;
}

export class HttpProtocol extends Protocol<HttpProtocol> {
  /** @internal */
  constructor(api: ApiModel, sourceFiles?: Array<SourceFile>) {
    super(HttpProtocol, api, sourceFiles);
    if (!sourceFiles) {
      // add the checkers for header types
      api.KnownAliasTypes['header'] = isHeader;
    }
  }

  authentications = new Array<Authentication|Alias<Authentication>>();

  /**
   * Global authentication requirements, which may be overridden by individual operations.
   * Only one of the elements in the array needs to be satisfied to authorize a request.
   */
  authenticationRequirements = new Array<AuthenticationRequirement|Alias<AuthenticationRequirement>>();

  /** Global connections, which may be overridden by individual operations. */
  connections = new Array<Connection | Alias<Connection>>();

  get operationGroups(): Array<OperationGroup> {
    // for now, just get the operation groups and assume they are http
    return this.files.map(each => each.getInterfaces().filter(isOperationGroupInterfaceType).map(each => new OperationGroup(each))).flat();
  }

  get responseCollections(): Array<Declaration<ResponseCollection>> {
    return this.files.map(each => each.getTypeAliases().filter(isResponseCollectionTypeAlias)).flat().map(each => new Declaration(each, ResponseCollection));
  }

  get responses(): Array<Declaration<Response>> {
    return this.files.map(each => each.getTypeAliases().filter(isResponseTypeAlias)).flat().map(each => new Declaration(each, Response));
  }

  get results(): Array<Declaration<Result>> {
    return [
      ... this.files.map(each => each.getTypeAliases().filter(isResultTypeAlias)).flat().map(each => new Declaration(each, Result)),
      ... this.files.map(each => each.getInterfaces().filter(isResultInterfaceType)).flat().map(each => new Declaration(each, Result))
    ];
  }

  get parameters(): Array<Declaration<Parameter>> {
    // Query, Body, Header, Cookie
    return this.files.map(each => each.getTypeAliases().filter(isParameterTypeAlias)).flat().map(each => new Declaration(each, Parameter));
  }

  get headers(): Array<Declaration<Header>> {
    return this.files.map(each => each.getTypeAliases().filter(isHeader)).flat().map(each => new Declaration(each, Header));
  }

  createOperationGroup() {
    throw new Error('not implemented');
  }

  createOperationResultAlias() {
    throw new Error('not implemented');
  }
}