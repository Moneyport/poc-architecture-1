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

import { MojaLogger, Metrics, TMetricOptionsType } from '@mojaloop-poc/lib-utilities'
import { ILogger } from '@mojaloop-poc/lib-domain'
import { TApiServerOptions, ApiServer, IRunHandler, KafkaInfraTypes } from '@mojaloop-poc/lib-infrastructure'
import { ParticipantCmdHandler } from './participantCmdHandler'
import { ParticipantEvtHandler } from './participantEvtHandler'
import * as dotenv from 'dotenv'
import { Command } from 'commander'
import { resolve as Resolve } from 'path'

/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const pckg = require('../../package.json')

const Program = new Command()
Program
  .version('0.1')
  .description('CLI to manage Participant Handlers')
Program.command('handler')
  .alias('h')
  .description('Start Participant Handlers') // command description
  .option('-c, --config [configFilePath]', '.env config file')
  .option('--disableApi', 'Disable API server for health & metrics')
  .option('--participantsEvt', 'Start the Participant Evt Handler')
  .option('--participantsCmd', 'Start the Participant Cmd Handler')

  // function to execute when command is uses
  .action(async (args: any): Promise<void> => {
    // #env file
    const configFilePath = args.config
    const dotenvConfig: any = {
      debug: true
    }
    if (configFilePath != null) {
      dotenvConfig.path = Resolve(process.cwd(), configFilePath)
    }
    dotenv.config(dotenvConfig)

    // # setup application config
    const appConfig = {
      kafka: {
        host: process.env.KAFKA_HOST,
        consumer: (process.env.KAFKA_CONSUMER == null) ? KafkaInfraTypes.NODE_KAFKA : process.env.KAFKA_CONSUMER,
        producer: (process.env.KAFKA_PRODUCER == null) ? KafkaInfraTypes.NODE_KAFKA : process.env.KAFKA_PRODUCER
      },
      redis: {
        host: process.env.REDIS_HOST
      }
    }

    // Instantiate logger
    const logger: ILogger = new MojaLogger()

    // Instantiate metrics factory

    const metricsConfig: TMetricOptionsType = {
      timeout: 5000, // Set the timeout in ms for the underlying prom-client library. Default is '5000'.
      prefix: 'poc_part_', // Set prefix for all defined metrics names
      defaultLabels: { // Set default labels that will be applied to all metrics
        serviceName: 'participants'
      }
    }

    const metrics = new Metrics(metricsConfig)
    await metrics.init()

    logger.debug(`appConfig=${JSON.stringify(appConfig)}`)

    // list of all handlers
    const runHandlerList: IRunHandler[] = []

    // start all handlers here
    if (args.participantsEvtHandler == null && args.participantsCmdHandler == null) {
      const participantEvtHandler = new ParticipantEvtHandler()
      await participantEvtHandler.start(appConfig, logger, metrics)
      runHandlerList.push(participantEvtHandler)

      const participantCmdHandler = new ParticipantCmdHandler()
      await participantCmdHandler.start(appConfig, logger, metrics)
      runHandlerList.push(participantCmdHandler)
    }

    // start only participantsEvtHandler
    if (args.participantsEvtHandler != null) {
      const participantEvtHandler = new ParticipantEvtHandler()
      await participantEvtHandler.start(appConfig, logger, metrics)
      runHandlerList.push(participantEvtHandler)
    }

    // start only participantsCmdHandler
    if (args.participantsCmdHandler != null) {
      const participantCmdHandler = new ParticipantCmdHandler()
      await participantCmdHandler.start(appConfig, logger, metrics)
      runHandlerList.push(participantCmdHandler)
    }

    // start only API
    if (args.disableApi == null) {
      const apiServerOptions: TApiServerOptions = {
        host: '0.0.0.0',
        port: 3003,
        metricCallback: async () => {
          return metrics.getMetricsForPrometheus()
        },
        healthCallback: async () => {
          return {
            status: 'ok',
            version: pckg.version,
            name: pckg.name
          }
        }
      }
      const apiServer: ApiServer = new ApiServer(apiServerOptions, logger)
      await apiServer.init()
    }

    // lets clean up all consumers here
    /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
    const killProcess = async (): Promise<void> => {
      logger.info('Exiting process...')
      logger.info('Destroying handlers...')
      /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
      runHandlerList.forEach(async (handler) => {
        logger.info(`\tDestroying handler...${handler.constructor.name}`)
        await handler.destroy()
      })
      logger.info('Exit complete!')
      process.exit(2)
    }
    /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
    process.on('SIGINT', killProcess)
  })

if (Array.isArray(process.argv) && process.argv.length > 2) {
  // parse command line vars
  Program.parse(process.argv)
} else {
  // display default help
  Program.help()
}
