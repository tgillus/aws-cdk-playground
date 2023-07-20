import 'dotenv/config';
import got, { Got } from 'got';
import { EitherAsync } from 'purify-ts';
import { Environment } from '../../infrastructure/environment/environment.js';

export class SecuritySettings {
  private readonly awsIamUser: string;
  private readonly request: Got;

  constructor({
    awsIamUser,
    openSearchDomain: domain,
    openSearchMasterUsername: username,
    openSearchMasterPassword: password,
  }: Environment) {
    this.awsIamUser = awsIamUser;
    this.request = got.extend({
      prefixUrl: domain,
      method: 'PUT',
      username,
      password,
    });
  }

  setup = () => {
    return EitherAsync(() =>
      this.request('_plugins/_security/api/rolesmapping/readall_and_monitor', {
        json: {
          users: [this.awsIamUser],
        },
      })
    )
      .map(() =>
        this.request('_plugins/_security/api/roles/index_mappings_readall', {
          json: {
            index_permissions: [
              {
                index_patterns: ['*'],
                allowed_actions: ['indices:admin/mappings/get'],
              },
            ],
          },
        })
      )
      .map(() =>
        this.request(
          '_plugins/_security/api/rolesmapping/index_mappings_readall',
          {
            json: {
              users: [this.awsIamUser],
            },
          }
        )
      )
      .map(() =>
        this.request('_plugins/_security/api/roles/indices_full_access', {
          json: {
            cluster_permissions: ['indices:data/write/bulk'],
            index_permissions: [
              {
                index_patterns: ['*'],
                allowed_actions: ['indices_all', 'indices:data/write/bulk'],
              },
            ],
          },
        })
      )
      .map(() =>
        this.request(
          '_plugins/_security/api/rolesmapping/indices_full_access',
          {
            json: {
              users: [this.awsIamUser],
            },
          }
        )
      );
  };
}

const settings = new SecuritySettings(Environment.load());
await settings.setup();
