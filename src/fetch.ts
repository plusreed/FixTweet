import { Constants } from './constants';

export const fetchUsingGuest = async (status: string): Promise<TimelineBlobPartial> => {
  let apiAttempts = 0;
  let cachedTokenFailed = false;

  const tokenHeaders: { [header: string]: string } = {
    Authorization: Constants.GUEST_BEARER_TOKEN,
    ...Constants.BASE_HEADERS
  };

  const guestTokenRequest = new Request(
    `${Constants.TWITTER_API_ROOT}/1.1/guest/activate.json`,
    {
      method: 'POST',
      headers: tokenHeaders,
      cf: {
        cacheEverything: true,
        cacheTtl: 600
      },
      body: ''
    }
  );

  const cache = caches.default;

  while (apiAttempts < 10) {
    const csrfToken = crypto
      .randomUUID()
      .replace(
        /-/g,
        ''
      ); /* Generate a random CSRF token, this doesn't matter, Twitter just cares that header and cookie match */

    const headers: { [header: string]: string } = {
      Authorization: Constants.GUEST_BEARER_TOKEN,
      ...Constants.BASE_HEADERS
    };

    apiAttempts++;

    let activate: Response | null = null;

    if (!cachedTokenFailed) {
      const cachedResponse = await cache.match(guestTokenRequest);

      if (cachedResponse) {
        console.log('Token cache hit');
        activate = cachedResponse;
      }

      console.log('Token cache miss');
      cachedTokenFailed = true;
    }

    if (cachedTokenFailed || activate === null) {
      /* If all goes according to plan, we have a guest token we can use to call API
        AFAIK there is no limit to how many guest tokens you can request.

        This can effectively mean virtually unlimited (read) access to Twitter's API,
        which is very funny. */
      activate = await fetch(guestTokenRequest);
    }

    /* Let's grab that guest_token so we can use it */
    let activateJson: { guest_token: string };

    try {
      activateJson = (await activate.json()) as { guest_token: string };
    } catch (e: unknown) {
      continue;
    }

    const guestToken = activateJson.guest_token;

    console.log('Activated guest:', activateJson);
    console.log('Guest token:', guestToken);

    /* Just some cookies to mimick what the Twitter Web App would send */
    headers['Cookie'] = [
      `guest_id_ads=v1%3A${guestToken}`,
      `guest_id_marketing=v1%3A${guestToken}`,
      `guest_id=v1%3A${guestToken}`,
      `ct0=${csrfToken};`
    ].join('; ');

    headers['x-csrf-token'] = csrfToken;
    headers['x-twitter-active-user'] = 'yes';
    headers['x-guest-token'] = guestToken;

    /* We pretend to be the Twitter Web App as closely as possible,
      so we use twitter.com/i/api/2 instead of api.twitter.com/2.
      We probably don't have to do this at all. But hey, better to be consistent with Twitter Web App. */
    let conversation: TimelineBlobPartial;
    let apiRequest;

    try {
      apiRequest = await fetch(
        `${Constants.TWITTER_ROOT}/i/api/2/timeline/conversation/${status}.json?${Constants.GUEST_FETCH_PARAMETERS}`,
        {
          method: 'GET',
          headers: headers
        }
      );
      conversation = await apiRequest.json();
    } catch (e: unknown) {
      /* We'll usually only hit this if we get an invalid response from Twitter.
         It's uncommon, but it happens */
      console.error('Unknown error while fetching conversation from API');
      cachedTokenFailed = true;
      continue;
    }

    if (
      typeof conversation.globalObjects === 'undefined' &&
      (typeof conversation.errors === 'undefined' ||
        conversation.errors?.[0]?.code ===
          239) /* TODO: i forgot what code 239 actually is lol */
    ) {
      console.log('Failed to fetch conversation, got', conversation);
      cachedTokenFailed = true;
      continue;
    }

    /* Once we've confirmed we have a working guest token, let's cache it! */
    // event.waitUntil(cache.put(guestTokenRequest, activate.clone()));
    conversation.guestToken = guestToken;
    return conversation;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error - This is only returned if we completely failed to fetch the conversation
  return {};
};
