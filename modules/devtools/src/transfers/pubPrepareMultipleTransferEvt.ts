// import { logger } from '../application'
import { publishMessageMultiple } from '../utilities/publisher'
import { CurrencyTypes, TransferPrepareRequestedEvt } from '@mojaloop-poc/lib-public-messages'
import { v4 as uuidv4 } from 'uuid'
import { ILogger } from '@mojaloop-poc/lib-domain'
import { ConsoleLogger } from '@mojaloop-poc/lib-utilities'

const logger: ILogger = new ConsoleLogger()

const timeout = async (ms: number): Promise<void> => {
  return await new Promise(resolve => setTimeout(resolve, ms))
}

const send = async (): Promise<void> => {
  const evts: TransferPrepareRequestedEvt[] = []

  for (let i = 0; i < 80; i++) {
    evts.push(new TransferPrepareRequestedEvt({
      transferId: uuidv4(),
      payerId: 'fsp-1',
      payeeId: 'fsp-2',
      currency: CurrencyTypes.USD,
      amount: 1
    }))
  }

  await publishMessageMultiple(evts)
  await timeout(1000)
}

/* eslint-disable-next-line @typescript-eslint/explicit-function-return-type */
const start = async () => {
  while (true) {
    await send()
  }
  // process.exit(0)
}

start().catch((err) => {
  logger.error(err)
}).finally(() => {
})
