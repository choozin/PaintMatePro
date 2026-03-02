import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// The service account is automatically available in the Cloud Functions environment
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Deletes a user from Firebase Authentication and their corresponding document in Firestore.
 * This function can only be called by an authenticated user with an 'owner' or 'admin' role.
 */
export const deleteUser = functions.https.onCall(async (data, context) => {
  // Check for authentication and role
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const callerRole = context.auth.token.role;
  if (callerRole !== 'owner' && callerRole !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You do not have permission to perform this action.'
    );
  }

  const { userId, orgId } = data;

  if (!userId || !orgId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with "userId" and "orgId" arguments.'
    );
  }

  // Prevent users from deleting themselves
  if (context.auth.uid === userId) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You cannot delete your own account.'
    );
  }

  try {
    // 1. Delete the user from Firebase Authentication
    await admin.auth().deleteUser(userId);
    console.log(`Successfully deleted user ${userId} from Authentication.`);

    // 2. Delete the user's document from the 'users' collection in Firestore
    const userDocRef = db.collection('users').doc(userId);
    await userDocRef.delete();
    console.log(`Successfully deleted user document for ${userId} from Firestore.`);

    return { success: true, message: `User ${userId} has been deleted.` };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'An unknown error occurred.'
    );
  }
});

/**
 * Updates a user's role within a specific organization.
 * This function can only be called by an authenticated user who is an 'org_owner' of the specified organization.
 */
export const updateUserRole = functions.https.onCall(async (data, context) => {
  // 1. Authenticate and Authorize Caller
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const callerUid = context.auth.uid;
  const callerClaims = context.auth.token;
  const callerOrgRole = callerClaims.orgs?.[data.orgId];

  // Only org_owners can update roles within their org
  if (callerOrgRole !== 'org_owner') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only an organization owner can update user roles.'
    );
  }

  const { userId, orgId, role } = data;

  if (!userId || !orgId || !role) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with "userId", "orgId", and "role" arguments.'
    );
  }

  // Prevent org_owners from changing their own role
  if (callerUid === userId) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You cannot change your own role.'
    );
  }

  // Validate the new role
  const validRoles = ['org_owner', 'org_admin', 'member'];
  if (!validRoles.includes(role)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid role specified.'
    );
  }

  try {
    // 2. Get Target User's Current Claims
    const targetUserRecord = await admin.auth().getUser(userId);
    const currentCustomClaims = targetUserRecord.customClaims || {};

    // 3. Update Target User's Custom Claims
    const updatedOrgRoles = {
      ...(currentCustomClaims.orgs || {}),
      [orgId]: role,
    };
    const newCustomClaims = {
      ...currentCustomClaims,
      orgs: updatedOrgRoles,
    };
    await admin.auth().setCustomUserClaims(userId, newCustomClaims);
    console.log(`Successfully updated custom claims for user ${userId}:`, newCustomClaims);

    // 4. Update Target User's Firestore Document
    const userDocRef = db.collection('users').doc(userId);
    await userDocRef.update({
      [`orgs.${orgId}`]: role, // Update the role in the Firestore document
    });
    console.log(`Successfully updated Firestore document for user ${userId} in org ${orgId} to role ${role}.`);

    return { success: true, message: `User ${userId} role updated to ${role} for organization ${orgId}.` };
  } catch (error: any) {
    console.error('Error updating user role:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'An unknown error occurred.'
    );
  }
});

// =============================================================================
// STRIPE CONNECT — Invoicing & Payments
// =============================================================================

import Stripe from 'stripe';

// Initialize Stripe with the platform's secret key (set via Firebase config)
// Set via: firebase functions:config:set stripe.secret_key="sk_..." stripe.webhook_secret="whsec_..."
const getStripe = () => {
  const secretKey = functions.config().stripe?.secret_key;
  if (!secretKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Stripe is not configured. Set stripe.secret_key via Firebase config.'
    );
  }
  return new Stripe(secretKey, { apiVersion: '2023-10-16' });
};

/**
 * Creates a Stripe Connect onboarding link for an organization.
 * The org owner connects their own Stripe account so payments go directly to them.
 *
 * Called by: Org Owner from the Organization Settings → Invoicing & Payments tab
 * Returns: { url: string } — The Stripe Connect onboarding URL to redirect the user to
 */
export const createStripeConnectLink = functions.https.onCall(async (data, context) => {
  // 1. Auth check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
  }

  const { orgId, returnUrl, refreshUrl } = data;
  if (!orgId) {
    throw new functions.https.HttpsError('invalid-argument', 'orgId is required.');
  }

  const stripe = getStripe();

  try {
    // 2. Check if org already has a Stripe account
    const orgDoc = await db.collection('orgs').doc(orgId).get();
    const orgData = orgDoc.data();
    let stripeAccountId = orgData?.invoiceSettings?.stripeAccountId;

    // 3. Create a new connected account if one doesn't exist
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        metadata: {
          orgId: orgId,
          platform: 'paintmatepro',
        },
      });
      stripeAccountId = account.id;

      // Save the account ID to the org doc
      await db.collection('orgs').doc(orgId).update({
        'invoiceSettings.stripeAccountId': stripeAccountId,
        'invoiceSettings.stripeOnboardingComplete': false,
      });
    }

    // 4. Create an Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl || `${data.baseUrl || 'http://localhost:5173'}/organization`,
      return_url: returnUrl || `${data.baseUrl || 'http://localhost:5173'}/organization?stripe=connected`,
      type: 'account_onboarding',
    });

    return { url: accountLink.url, accountId: stripeAccountId };
  } catch (error: any) {
    console.error('Error creating Stripe Connect link:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to create Stripe Connect link.');
  }
});

/**
 * Checks the status of a connected Stripe account and updates onboarding status.
 * Called after the user returns from Stripe onboarding to verify completion.
 */
export const checkStripeAccountStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
  }

  const { orgId } = data;
  if (!orgId) {
    throw new functions.https.HttpsError('invalid-argument', 'orgId is required.');
  }

  const stripe = getStripe();

  try {
    const orgDoc = await db.collection('orgs').doc(orgId).get();
    const orgData = orgDoc.data();
    const stripeAccountId = orgData?.invoiceSettings?.stripeAccountId;

    if (!stripeAccountId) {
      return { connected: false, onboardingComplete: false };
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);
    const isComplete = account.charges_enabled && account.payouts_enabled;

    // Update onboarding status
    await db.collection('orgs').doc(orgId).update({
      'invoiceSettings.stripeOnboardingComplete': isComplete,
    });

    return {
      connected: true,
      onboardingComplete: isComplete,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    };
  } catch (error: any) {
    console.error('Error checking Stripe account status:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Creates a Stripe Checkout Session for a specific invoice.
 * The session is created on behalf of the org's connected Stripe account,
 * so payment goes directly to them — PaintMatePro never touches the funds.
 *
 * Called by: Client Portal "Pay Now" button (via anonymous auth)
 * Returns: { sessionId: string, url: string } — The Checkout Session URL
 */
export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  // Allow anonymous auth (portal users)
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
  }

  const { invoiceId, successUrl, cancelUrl } = data;
  if (!invoiceId) {
    throw new functions.https.HttpsError('invalid-argument', 'invoiceId is required.');
  }

  const stripe = getStripe();

  try {
    // 1. Fetch the invoice
    const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Invoice not found.');
    }
    const invoice = invoiceDoc.data()!;

    // 2. Verify invoice is payable
    if (['paid', 'void', 'draft'].includes(invoice.status)) {
      throw new functions.https.HttpsError('failed-precondition', `Invoice cannot be paid (status: ${invoice.status}).`);
    }

    // 3. Get the org's connected Stripe account
    const orgDoc = await db.collection('orgs').doc(invoice.orgId).get();
    const orgData = orgDoc.data();
    const stripeAccountId = orgData?.invoiceSettings?.stripeAccountId;

    if (!stripeAccountId || !orgData?.invoiceSettings?.stripeOnboardingComplete) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'This organization has not completed Stripe payment setup.'
      );
    }

    // 4. Determine payment methods based on org settings
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [];
    if (orgData?.invoiceSettings?.paymentMethods?.card !== false) {
      paymentMethodTypes.push('card');
    }
    if (orgData?.invoiceSettings?.paymentMethods?.ach === true) {
      paymentMethodTypes.push('us_bank_account');
    }
    // Default to card if nothing is enabled
    if (paymentMethodTypes.length === 0) {
      paymentMethodTypes.push('card');
    }

    // 5. Calculate amount to charge (balance due, not total)
    const amountCents = Math.round((invoice.balanceDue || invoice.total) * 100);

    // 6. Create Checkout Session on the connected account
    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: paymentMethodTypes,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Invoice ${invoice.invoiceNumber}`,
                description: `Payment for project invoice`,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl || `${data.baseUrl || 'http://localhost:5173'}/portal?payment=success`,
        cancel_url: cancelUrl || `${data.baseUrl || 'http://localhost:5173'}/portal?payment=cancelled`,
        metadata: {
          invoiceId: invoiceId,
          orgId: invoice.orgId,
          projectId: invoice.projectId,
          platform: 'paintmatepro',
        },
      },
      {
        stripeAccount: stripeAccountId, // On behalf of the connected account
      }
    );

    return { sessionId: session.id, url: session.url };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('Error creating checkout session:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to create checkout session.');
  }
});

/**
 * Stripe Webhook Handler.
 * Receives events from Stripe when payments succeed, fail, etc.
 * Updates the invoice and payment records in Firestore.
 *
 * IMPORTANT: This is an HTTP function (not callable) because Stripe sends raw POST requests.
 * Must verify the webhook signature to prevent spoofing.
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const webhookSecret = functions.config().stripe?.webhook_secret;
  if (!webhookSecret) {
    console.error('Stripe webhook secret not configured.');
    res.status(500).send('Webhook secret not configured.');
    return;
  }

  const stripe = getStripe();
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoiceId;

        if (!invoiceId) {
          console.warn('Checkout session completed but no invoiceId in metadata.');
          break;
        }

        // Idempotency: Check if we've already recorded this payment
        const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
        if (!invoiceDoc.exists) {
          console.warn(`Invoice ${invoiceId} not found for completed checkout.`);
          break;
        }

        const invoice = invoiceDoc.data()!;
        const existingPayments: any[] = invoice.payments || [];
        const alreadyRecorded = existingPayments.some(
          (p: any) => p.stripePaymentIntentId === session.payment_intent
        );

        if (alreadyRecorded) {
          console.log(`Payment for invoice ${invoiceId} already recorded. Skipping.`);
          break;
        }

        // Record the payment
        const paymentAmount = (session.amount_total || 0) / 100;
        const newPayment = {
          id: `pay_${Date.now()}`,
          amount: paymentAmount,
          date: admin.firestore.Timestamp.now(),
          method: session.payment_method_types?.[0] === 'us_bank_account' ? 'stripe_ach' : 'stripe_card',
          stripePaymentIntentId: session.payment_intent as string,
          stripeChargeId: session.id,
          notes: 'Paid via Stripe Checkout',
          createdAt: admin.firestore.Timestamp.now(),
        };

        const updatedPayments = [...existingPayments, newPayment];
        const newAmountPaid = (invoice.amountPaid || 0) + paymentAmount;
        const newBalanceDue = Math.max(0, (invoice.total || 0) - newAmountPaid);
        const newStatus = newBalanceDue <= 0 ? 'paid' : 'partially_paid';

        const updateData: Record<string, any> = {
          payments: updatedPayments,
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: newStatus,
          updatedAt: admin.firestore.Timestamp.now(),
        };

        if (newStatus === 'paid') {
          updateData.paidAt = admin.firestore.Timestamp.now();
        }

        await db.collection('invoices').doc(invoiceId).update(updateData);

        // Update project status if all invoices are paid
        if (newStatus === 'paid' && invoice.projectId) {
          const projectInvoices = await db.collection('invoices')
            .where('projectId', '==', invoice.projectId)
            .get();

          const allPaid = projectInvoices.docs.every(d => {
            const data = d.data();
            return d.id === invoiceId ? true : data.status === 'paid' || data.status === 'void';
          });

          if (allPaid) {
            await db.collection('projects').doc(invoice.projectId).update({
              status: 'paid',
              updatedAt: admin.firestore.Timestamp.now(),
            });
          }
        }

        console.log(`✅ Payment of $${paymentAmount} recorded for invoice ${invoiceId}. New status: ${newStatus}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.warn(`❌ Payment failed for PaymentIntent ${paymentIntent.id}:`, paymentIntent.last_payment_error?.message);
        // We don't update the invoice status here — it stays as 'sent' or 'viewed'
        // The client can retry payment
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed.' });
  }
});