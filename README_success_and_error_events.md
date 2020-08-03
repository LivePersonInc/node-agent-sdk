# Success and Error Events


Node Agent SDK emits events when a flow succeeds or fails. These events will be useful in determining action items to take, as well as giving visibility about a particular flow in the SDK. 

For example, you might want to have some metrics that keep track of how many times 'RefreshSession#Login' flow fails vs succeeding.


## Success

Success events provide you with a parameter called context:

```javascript
{
    location: 'Event#Source'    // The source location of the event, for example 'Reconnect#Login', 
                                // which happens during the login section of the reconnect function
}
```

An example of implementation on putting a metric on the success events would be:

```javascript
agent.on('success', (context) => {
    metricsInterface.countSuccess(context.location, 1);
});
```

## Error

There are two parameters that are passed in to the error event.

* error:

```javascript
// The SDKError object that centralizes the error sources across the SDK
{
   message: 'the message of the error',
   code: 401, // Error code if the error actually comes from a network call (such as a REST API invocation)
   error: Error // The original error object if it comes from another error
}
```

* context:
```javascript
{
    location: 'Event#Source' // The source location of the event, for example 'Reconnect#Login', which happens during the login section of the reconnect function
}
```

An example of implementation of metricizing the event would be:

```javascript
agent.on('error', (error, context) => {
   metricsInterface.countFailure(context.location, 1);
});
```

## Reconnect General Failure Cases
### Error codes 429 or 5xx

This indicates that you might be rate-limited or the service is down. Please implement a retry logic with exponential backoff on the [reconnect()](README.md#reconnectskiptokengeneration) function
**without** token generation. You can copy the `_reconnect` function from the [closed event section](README.md#reconnect-with-retry). For example:

```javascript
// on connected cancel any retry interval remaining from reconnect attempt
agent.on('connected', () => {
    clearTimeout(agent._retryConnection);
});

agent.on('error', (err, context) => {
    if (err && (err.code === 429 || err.code >= 500)) {
        agent._reconnect(true); // do not re-generate token
    }
});
```

### Error codes 401 or 403

This indicates that your token might be expired. Please implement a retry logic with exponential backoff on the [reconnect()](README.md#reconnectskiptokengeneration) function
**with** token generation. You can copy the `_reconnect` function from the [closed event section](README.md#reconnect-with-retry). For example:

```javascript
agent.on('error', (err, context) => {
   if (err && (err.code === 401 || err.code 403)) {
       agent._reconnect(); // regenerate token
   }
});
```


## Details of the Context Location

### Connect#CSDS

#### Description

This happens when the bot is trying to contact to the LivePerson's domains service when the bot is trying to establish a WebSocket connection
for the very first time.

It happens inside the [connect](README.md#connectcallback) function.

#### Failure Cases

Please refer to [General Failure Cases](#reconnect-general-failure-cases).

### Connect#Login

#### Description

This happens when the bot is trying to login to LivePerson when the bot is trying to establish a WebSocket connection
for the very first time.

It happens inside the [connect](README.md#connectcallback) function.

#### Failure Cases

Please refer to [General Failure Cases](#reconnect-general-failure-cases).

### Reconnect#CSDS

#### Description

This happens when the bot is trying to contact to the LivePerson's domains service when the bot is trying to establish a WebSocket connection after it was disconnected.

It happens inside the [reconnect(skipTokenGeneration)](README.md#reconnectskiptokengeneration) function.

#### Failure Cases

Please refer to [General Failure Cases](#reconnect-general-failure-cases).

### Reconnect#Relogin#WS

#### Description

This happens when the bot is trying to login and re-establish a WS connection to LivePerson after the bot was disconnected. 

It happens inside the [reconnect(skipTokenGeneration)](README.md#reconnectskiptokengeneration) function.

#### Failure Cases

Please refer to [General Failure Cases](#reconnect-general-failure-cases).

### RefreshSession#CSDS

This happens when the bot is trying to contact to the LivePerson's domains service when the bot is trying to prolong the agent's session.

It happens inside the [refreshSession(callback)](README.md#refreshsessioncallback) function.

#### Failure Cases

##### Error codes 429 or 5xx for Refresh Sessions

This indicates that you might be rate-limited or the service is down. Please implement a retry logic with exponential backoff on the [refreshSession(callback)](README.md#refreshsessioncallback) function.
 
If you want to attempt to reconnect repeatedly you should initiate a periodic reconnect attempt here. **LivePerson recommends that you make periodic reconnect attempts at increasing intervals up to a finite number of attempts in order to prevent flooding our service and being blocked as a potentially abusive client**. See [LivePerson's retry policy guidelines](https://developers.liveperson.com/guides-retry-policy.html) for more information.

In the sample below we attempt to reconnect 35 times, waiting 5 seconds the first time and increasing the interval by a factor of 1.25 between each attempt.

###### Reconnect with Retry

```javascript
const reconnectInterval = 5;        // in seconds
const reconnectAttempts = 35;
const reconnectRatio    = 1.25;     // ratio in the geometric series used to determine reconnect exponential back-off

agent._refreshSession = (delay = reconnectInterval, attempt = 1) => {
    // Clear the timeouts from before
    clearTimeout(agent._refreshRetryConnection);
    
    agent._refreshRetryConnection = setTimeout(() => {
        agent.refreshSession(() => {});
        if (++attempt <= reconnectAttempts) { 
            agent._refreshSession(delay * reconnectRatio, attempt);
        }
    }, delay * 1000);
}
```
###### Retry Logic Example

```javascript
// on success of the RefreshSession Events, we should cancel the retry timeout _refreshRetryConnection above
// and restart the refreshSession loop to avoid it being stopped
agent.on('success', (err, context) => {
   if (context.startsWith('RefreshSession')) {
       clearTimeout(agent._refreshRetryConnection);
       // Restart the refreshSession loop
       this.startPeriodicRefreshSession();
   }
});

// 429 and 5xx cases
agent.on('error', (err, context) => {
   if (err && (err.code === 429 || err.code >= 500) && context.location.startsWith('RefreshSession')) {
       agent._refreshSession();
   }
});
```

### RefreshSession#REST

This happens when the bot is trying to contact to the API endpoint to prolong the agent's session.

It happens inside the [refreshSession(callback)](README.md#refreshsessioncallback) function.

#### Failure Cases

Please refer to the [Refresh Session's Failure Cases](#error-codes-429-or-5xx-for-refresh-sessions)

### RefreshSession#Relogin#WS

This happens when the bot is trying to contact to re-connect the agent bot when a bearer token is expired.

It happens inside the [refreshSession(callback)](README.md#refreshsessioncallback) function.

#### Failure Cases

Please refer to the [Refresh Session's Failure Cases](#error-codes-429-or-5xx-for-refresh-sessions)
