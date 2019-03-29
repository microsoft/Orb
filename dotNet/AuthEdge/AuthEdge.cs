/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

namespace Orb
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Runtime.Remoting.Messaging;
    using System.Threading.Tasks;
    using System.Globalization;

    using Microsoft.IdentityModel.Clients.ActiveDirectory;

    public class AuthEdge
    {
        AuthenticationContext ctx;

        public AuthEdge()
        {

        }

        public class AuthResult
        {
            public string Scheme { get; set; }

            public string Parameter { get; set; }

            public string Error { get; set; }
        }

        public async Task<object> AcquireToken(object input)
        {
            var inputDict = input as IDictionary<string, object>;

            if (inputDict == null)
            {
                throw new ArgumentException("input");
            }

            string clientId = inputDict["ClientId"] as string;
            string replyUri = inputDict["ReplyUri"] as string;
            string resourceId = inputDict["ResourceId"] as string;
            string cacheLocation = inputDict["CacheLocation"] as string;
            AuthResult authResult = new AuthResult();

            if (this.ctx == null)
            {
                this.ctx = GetAuthenticationContext(null, cacheLocation);
            }

            try
            {
                AuthenticationResult result =
                    await Task.Run(() => this.ctx.AcquireTokenSilentAsync(resourceId, clientId));

                authResult.Scheme = "Bearer";
                authResult.Parameter = result.AccessToken;
            }
            catch (AdalException)
            {
                AuthenticationResult result =
                    this.ctx.AcquireTokenAsync(
                        resourceId,
                        clientId,
                        new Uri(replyUri),
                        new PlatformParameters(PromptBehavior.RefreshSession)).Result;

                authResult.Scheme = "Bearer";
                authResult.Parameter = result.AccessToken;
            }
            catch (Exception ex)
            {
                authResult.Error = ex.Message;
            }

            return authResult;
        }

        private AuthenticationContext GetAuthenticationContext(string tenant, string cacheLocation)
        {
            AuthenticationContext ctx = null;
            if (tenant != null)
                ctx = new AuthenticationContext("https://login.microsoftonline.com/" + tenant, new FileCache(cacheLocation));
            else
            {
                ctx = new AuthenticationContext("https://login.windows.net/common", new FileCache(cacheLocation));
                if (ctx.TokenCache.Count > 0)
                {
                    string homeTenant = ctx.TokenCache.ReadItems().First().TenantId;
                    ctx = new AuthenticationContext("https://login.microsoftonline.com/" + homeTenant, new FileCache(cacheLocation));
                }
            }

            return ctx;
        }
    }
}
