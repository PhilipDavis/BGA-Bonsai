<?php

class EventEmitter
{
    protected $eventSubscribers = [];

    public function on(string $eventName, callable $subscriber)
    {
        if (!array_key_exists($eventName, $this->eventSubscribers))
            $this->eventSubscribers[$eventName] = [];

        $this->eventSubscribers[$eventName][] = $subscriber;
    }

    protected function emit(string $eventName, array $args = [])
    {
        // Bail out if there are no subscribers to this event
        if (!array_key_exists($eventName, $this->eventSubscribers))
            return;

        $subscribers = $this->eventSubscribers[$eventName];
        foreach ($subscribers as $subscriber)
            call_user_func_array($subscriber, $args);
    }
}
