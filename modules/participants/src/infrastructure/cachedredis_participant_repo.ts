/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Coil
 - Donovan Changfoot <donovan.changfoot@coil.com>

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 * ModusBox
 - Miguel de Barros <miguel.debarros@modusbox.com>
 - Roman Pietrzak <roman.pietrzak@modusbox.com>

 --------------
******/

'use strict'

import * as redis from 'redis'
import { ILogger } from '@mojaloop-poc/lib-domain'
import { ParticipantState } from '../domain/participant_entity'
import { IParticipantRepo } from '../domain/participant_repo'
import { ParticipantAccountTypes, ParticipantEndpoint } from '@mojaloop-poc/lib-public-messages'

/***
 * TODO:
* - Store currently only stores ParticipantState if it was not found in the `_inMemorylist`. /
*   This should be fixed in future to ensure that there consistency between the in-memory cache and redis. /
*   However this is easier said than done, and needs some thinking. This is however not a concern at this /
*   stage as we expect a CQRS pattern to be used over this repo.
 */

export class CachedRedisParticipantStateRepo implements IParticipantRepo {
  protected _redisClient!: redis.RedisClient
  private readonly _inMemorylist: Map<string, ParticipantState> = new Map<string, ParticipantState>()
  private readonly _redisConnStr: string
  private readonly _logger: ILogger
  private _initialized: boolean = false
  private readonly keyPrefix: string = 'participant_'

  constructor (connStr: string, logger: ILogger) {
    this._redisConnStr = connStr
    this._logger = logger
  }

  async init (): Promise<void> {
    return await new Promise((resolve, reject) => {
      this._redisClient = redis.createClient({ url: this._redisConnStr })

      this._redisClient.on('ready', () => {
        this._logger.isInfoEnabled() && this._logger.info('Redis client ready')
        if (this._initialized) { return }

        this._initialized = true
        return resolve()
      })

      this._redisClient.on('error', (err) => {
        this._logger.isErrorEnabled() && this._logger.error(err, 'A redis error has occurred:')
        if (!this._initialized) { return reject(err) }
      })
    })
  }

  async destroy (): Promise<void> {
    if (this._initialized) { this._redisClient.quit() }

    return await Promise.resolve()
  }

  canCall (): boolean {
    return this._initialized // for now, no circuit breaker exists
  }

  async load (id: string): Promise<ParticipantState|null> {
    return await new Promise((resolve, reject) => {
      if (!this.canCall()) return reject(new Error('Repository not ready'))

      const key: string = this.keyWithPrefix(id)

      if (this._inMemorylist.has(key)) {
        return resolve(this._inMemorylist.get(key))
      }

      this._redisClient.get(key, (err: Error | null, result: string | null) => {
        if (err != null) {
          this._logger.isErrorEnabled() && this._logger.error(err, 'Error fetching entity state from redis - for key: ' + key)
          return reject(err)
        }
        if (result == null) {
          this._logger.isDebugEnabled() && this._logger.debug('Entity state not found in redis - for key: ' + key)
          return resolve(null)
        }
        try {
          const state: ParticipantState = JSON.parse(result)

          this._inMemorylist.set(key, state)

          return resolve(state)
        } catch (err) {
          this._logger.isErrorEnabled() && this._logger.error(err, 'Error parsing entity state from redis - for key: ' + key)
          return reject(err)
        }
      })
    })
  }

  async remove (id: string): Promise<void> {
    return await new Promise((resolve, reject) => {
      if (!this.canCall()) return reject(new Error('Repository not ready'))

      const key: string = this.keyWithPrefix(id)

      if (this._inMemorylist.has(key)) {
        this._inMemorylist.delete(key)
      }

      this._redisClient.del(key, (err?: Error|null, result?: number) => {
        if (err != null) {
          this._logger.isErrorEnabled() && this._logger.error(err, 'Error removing entity state from redis - for key: ' + key)
          return reject(err)
        }
        if (result !== 1) {
          this._logger.isDebugEnabled() && this._logger.debug('Entity state not found in redis - for key: ' + key)
          return resolve()
        }

        return resolve()
      })
    })
  }

  async store (entityState: ParticipantState): Promise<void> {
    return await new Promise((resolve, reject) => {
      if (!this.canCall()) return reject(new Error('Repository not ready'))

      const key: string = this.keyWithPrefix(entityState.id)

      this._logger.isDebugEnabled() && this._logger.debug(`CachedRedisParticipantStateRepo::store - storing ${entityState.id} in-memory only, AND redis as we have not seen this participant before!`)

      this._inMemorylist.set(key, entityState)

      resolve()

      /* let stringValue: string | null = null
      try {
        stringValue = JSON.stringify(entityState)
      } catch (err) {
        this._logger.isErrorEnabled() && this._logger.error(err, 'Error parsing entity state JSON - for key: ' + key)
      }

      if (stringValue === null) {
        return
      }

      this._redisClient.set(key, stringValue, (err: Error | null, reply: string) => {
        if (err != null) {
          this._logger.isErrorEnabled() && this._logger.error(err, 'Error storing entity state to redis - for key: ' + key)
        }
        if (reply !== 'OK') {
          this._logger.isErrorEnabled() && this._logger.error('Unsuccessful attempt to store the entity state in redis - for key: ' + key)
        }
      }) */
    })
  }

  private keyWithPrefix (key: string): string {
    return this.keyPrefix + key
  }

  async hasAccount (participantId: string, accType: ParticipantAccountTypes, currency: string): Promise<boolean> {
    const participant = await this.load(participantId)
    return participant?.accounts?.find(account => account.type === accType && account.currency === currency) != null
  }

  async getEndPoints (participantId: string): Promise<ParticipantEndpoint[]|undefined> {
    const participant = await this.load(participantId)
    return participant?.endpoints
  }
}
