import { db } from '.'
import { webhooks } from './schema'
import { faker } from '@faker-js/faker'

const stripeEvents = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.processing',
  'payment_intent.canceled',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.upcoming',
  'charge.succeeded',
  'charge.failed',
  'charge.refunded',
  'customer.created',
  'customer.updated',
  'customer.deleted',
]

const stripeIps = [
  '3.18.12.63',
  '3.130.192.231',
  '35.71.192.136',
  '35.90.151.110',
  '52.219.56.111',
  '54.187.174.169',
  '54.187.205.235',
  '54.187.216.72',
]

function generateStripeBody(eventType: string) {
  const customerId = `cus_${faker.string.alphanumeric(14)}`
  const chargeId = `ch_${faker.string.alphanumeric(14)}`
  const subscriptionId = `sub_${faker.string.alphanumeric(14)}`
  const invoiceId = `in_${faker.string.alphanumeric(14)}`
  const paymentIntentId = `pi_${faker.string.alphanumeric(14)}`
  const amount = faker.number.int({ min: 500, max: 100000 })

  const baseObject = {
    id: `evt_${faker.string.alphanumeric(14)}`,
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(faker.date.recent({ days: 30 }).getTime() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: `req_${faker.string.alphanumeric(14)}`,
      idempotency_key: faker.string.uuid(),
    },
    type: eventType,
  }

  switch (eventType) {
    case 'payment_intent.succeeded':
      return {
        ...baseObject,
        data: {
          object: {
            id: paymentIntentId,
            object: 'payment_intent',
            amount,
            currency: 'usd',
            status: 'succeeded',
            customer: customerId,
            payment_method: `pm_${faker.string.alphanumeric(14)}`,
            created: Math.floor(Date.now() / 1000),
            metadata: {},
          },
        },
      }

    case 'invoice.paid':
      return {
        ...baseObject,
        data: {
          object: {
            id: invoiceId,
            object: 'invoice',
            amount_paid: amount,
            currency: 'usd',
            customer: customerId,
            status: 'paid',
            subscription: subscriptionId,
            total: amount,
            payment_intent: paymentIntentId,
          },
        },
      }

    case 'customer.subscription.created':
      return {
        ...baseObject,
        data: {
          object: {
            id: subscriptionId,
            object: 'subscription',
            customer: customerId,
            currency: 'usd',
            current_period_end:
              Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            current_period_start: Math.floor(Date.now() / 1000),
            status: 'active',
            items: {
              object: 'list',
              data: [
                {
                  id: `si_${faker.string.alphanumeric(14)}`,
                  object: 'subscription_item',
                  price: `price_${faker.string.alphanumeric(14)}`,
                  quantity: 1,
                },
              ],
            },
          },
        },
      }

    case 'charge.succeeded':
      return {
        ...baseObject,
        data: {
          object: {
            id: chargeId,
            object: 'charge',
            amount,
            currency: 'usd',
            customer: customerId,
            payment_intent: paymentIntentId,
            status: 'succeeded',
            paid: true,
          },
        },
      }

    default:
      return {
        ...baseObject,
        data: {
          object: {
            id: faker.string.alphanumeric(24),
            object: eventType.split('.')[0],
            created: Math.floor(Date.now() / 1000),
          },
        },
      }
  }
}

async function seed() {
  await db.delete(webhooks)

  const webhookRecords = Array.from({ length: 60 }, () => {
    const eventType = faker.helpers.arrayElement(stripeEvents)
    const body = generateStripeBody(eventType)

    return {
      method: 'POST',
      pathname: '/stripe/webhook',
      ip: faker.helpers.arrayElement(stripeIps),
      statusCode: 200,
      contentType: 'application/json',
      contentLength: JSON.stringify(body).length,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
        'stripe-signature': `t=${Date.now()},v1=${faker.string.alphanumeric(64)}`,
        'accept-encoding': 'gzip',
        'connect-time': faker.number.int({ min: 1, max: 100 }).toString(),
        host: faker.internet.domainName(),
      },
      body: JSON.stringify(body, null, 2),
    }
  })

  await db.insert(webhooks).values(webhookRecords)

  console.log('✅ Database seeded with Stripe webhook events!')
}

seed().catch((error) => {
  console.error('Error seeding database:', error)
  process.exit(1)
})
