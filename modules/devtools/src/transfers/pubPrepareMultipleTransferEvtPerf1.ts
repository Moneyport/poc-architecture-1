import * as Publisher from '../utilities/publisher'
import {
  CurrencyTypes,
  TransferPrepareRequestedEvt
} from '@mojaloop-poc/lib-public-messages'
import { v4 as uuidv4 } from 'uuid'
import { ILogger } from '@mojaloop-poc/lib-domain'
import { MojaLogger } from '@mojaloop-poc/lib-utilities'

/* eslint-disable @typescript-eslint/no-var-requires */
const encodePayload = require('@mojaloop/central-services-shared').Util.StreamingProtocol.encodePayload

const logger: ILogger = new MojaLogger()
const STR_INJECTED_PER_SECOND = process.env?.INJECTED_PER_SECOND ?? '50'
const INJECTED_PER_SECOND = Number.parseInt(STR_INJECTED_PER_SECOND)
const contentType = 'application/vnd.interoperability.transfers+json;version=1'

const timeout = async (ms: number): Promise<void> => {
  return await new Promise(resolve => setTimeout(resolve, ms))
}

const getRandomFsps = (): string[] => {
  const fspIds = ['simfsp01', 'simfsp02', 'simfsp03', 'simfsp04', 'simfsp05', 'simfsp06', 'simfsp07', 'simfsp08' ]
  const random = Math.floor(Math.random() * Math.floor(fspIds.length))

  const payer: string = fspIds[random]
  const payee: string = random + 1 >= fspIds.length ? fspIds[0] : fspIds[random + 1]
  return [payer, payee]
}

const send = async (): Promise<void> => {
  const evts: TransferPrepareRequestedEvt[] = []
  const expireDate = new Date()
  expireDate.setMinutes(expireDate.getMinutes() + 5)

  for (let i = 0; i < INJECTED_PER_SECOND; i++) {
    const fspIds = getRandomFsps()

    const preparePayload = {
      transferId: uuidv4(),
      payerFsp: fspIds[0],
      payeeFsp: fspIds[1],
      amount: {
        amount: '1.11',
        currency: CurrencyTypes.USD
      },
      expiration: expireDate.toISOString(), // '2020-06-09T20:46:57.650Z',
      ilpPacket: 'AQAAAAAAAADIEHByaXZhdGUucGF5ZWVmc3CCAiB7InRyYW5zYWN0aW9uSWQiOiIyZGY3NzRlMi1mMWRiLTRmZjctYTQ5NS0yZGRkMzdhZjdjMmMiLCJxdW90ZUlkIjoiMDNhNjA1NTAtNmYyZi00NTU2LThlMDQtMDcwM2UzOWI4N2ZmIiwicGF5ZWUiOnsicGFydHlJZEluZm8iOnsicGFydHlJZFR5cGUiOiJNU0lTRE4iLCJwYXJ0eUlkZW50aWZpZXIiOiIyNzcxMzgwMzkxMyIsImZzcElkIjoicGF5ZWVmc3AifSwicGVyc29uYWxJbmZvIjp7ImNvbXBsZXhOYW1lIjp7fX19LCJwYXllciI6eyJwYXJ0eUlkSW5mbyI6eyJwYXJ0eUlkVHlwZSI6Ik1TSVNETiIsInBhcnR5SWRlbnRpZmllciI6IjI3NzEzODAzOTExIiwiZnNwSWQiOiJwYXllcmZzcCJ9LCJwZXJzb25hbEluZm8iOnsiY29tcGxleE5hbWUiOnt9fX0sImFtb3VudCI6eyJjdXJyZW5jeSI6IlVTRCIsImFtb3VudCI6IjIwMCJ9LCJ0cmFuc2FjdGlvblR5cGUiOnsic2NlbmFyaW8iOiJERVBPU0lUIiwic3ViU2NlbmFyaW8iOiJERVBPU0lUIiwiaW5pdGlhdG9yIjoiUEFZRVIiLCJpbml0aWF0b3JUeXBlIjoiQ09OU1VNRVIiLCJyZWZ1bmRJbmZvIjp7fX19',
      // condition: 'HOr22-H3AfTDHrSkPjJtVPRdKouuMkDXTR4ejlQa8Ks'
      // condition: 'eqLXL11vT-db_1JPAjFkLX5QP2UOFTUmbyEPbnJxNlc'
      condition: 'HOr22-H3AfTDHrSkPjJtVPRdKouuMkDXTR4ejlQa8Ks'
    }

    const encodedPreparePayload = encodePayload(Buffer.from(JSON.stringify(preparePayload)), contentType)

    evts.push(new TransferPrepareRequestedEvt({
      transferId: preparePayload.transferId,
      payerId: preparePayload.payerFsp,
      payeeId: preparePayload.payeeFsp,
      currency: preparePayload.amount.currency,
      amount: preparePayload.amount.amount,
      expiration: preparePayload.expiration,
      condition: preparePayload.condition,
      prepare: {
        headers: {
          accept: 'application/vnd.interoperability.transfers+json;version=1',
          'content-type': 'application/vnd.interoperability.transfers+json;version=1.0',
          date: '2020-06-08T08:15:26.000Z',
          'fspiop-source': preparePayload.payerFsp,
          'fspiop-destination': preparePayload.payeeFsp,
          'fspiop-signature': '{"signature":"iU4GBXSfY8twZMj1zXX1CTe3LDO8Zvgui53icrriBxCUF_wltQmnjgWLWI4ZUEueVeOeTbDPBZazpBWYvBYpl5WJSUoXi14nVlangcsmu2vYkQUPmHtjOW-yb2ng6_aPfwd7oHLWrWzcsjTF-S4dW7GZRPHEbY_qCOhEwmmMOnE1FWF1OLvP0dM0r4y7FlnrZNhmuVIFhk_pMbEC44rtQmMFv4pm4EVGqmIm3eyXz0GkX8q_O1kGBoyIeV_P6RRcZ0nL6YUVMhPFSLJo6CIhL2zPm54Qdl2nVzDFWn_shVyV0Cl5vpcMJxJ--O_Zcbmpv6lxqDdygTC782Ob3CNMvg","protectedHeader":"eyJhbGciOiJSUzI1NiIsIkZTUElPUC1VUkkiOiIvdHJhbnNmZXJzIiwiRlNQSU9QLUhUVFAtTWV0aG9kIjoiUE9TVCIsIkZTUElPUC1Tb3VyY2UiOiJPTUwiLCJGU1BJT1AtRGVzdGluYXRpb24iOiJNVE5Nb2JpbGVNb25leSIsIkRhdGUiOiIifQ"}',
          'fspiop-uri': '/transfers',
          'fspiop-http-method': 'POST',
          'user-agent': 'PostmanRuntime/7.25.0',
          'cache-control': 'no-cache',
          'postman-token': 'e9db5115-86d7-48dd-ab0f-07b4059d5063',
          host: 'ml-api-adapter.local:3000',
          'accept-encoding': 'gzip, deflate, br',
          connection: 'keep-alive',
          'content-length': '1062'
        },
        payload: encodedPreparePayload
      }
    }
    ))
  }
  await Publisher.publishMessageMultiple(evts)
  await timeout(1000)
}

/* eslint-disable-next-line @typescript-eslint/explicit-function-return-type */
const start = async () => {
  logger.info('Starting pubPrepareMultipleTransferEvt publisher!')
  await Publisher.init()
  await Publisher.publishMessageMultipleInit()
  while (true) {
    await send()
  }
}

// lets clean up all consumers here
/* eslint-disable-next-line @typescript-eslint/no-misused-promises */
const killProcess = async (): Promise<void> => {
  logger.info('Exiting process...')
  logger.info('Destroying handlers...')
  await Publisher.publishMessageMultipleDestroy()

  logger.info('Exit complete!')
  process.exit(0)
}
/* eslint-disable-next-line @typescript-eslint/no-misused-promises */
process.on('SIGINT', killProcess)

start().catch((err) => {
  logger.error(err)
}).finally(() => {
})