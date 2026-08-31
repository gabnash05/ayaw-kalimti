export interface PlacesSearchPort<Request, Response> {
  search(request: Readonly<Request>): Promise<Response>;
}

export interface MapLinkResolverPort<Request, Response> {
  resolve(request: Readonly<Request>): Promise<Response>;
}

export interface PushTransportPort<Request, Response> {
  send(request: Readonly<Request>): Promise<Response>;
}

export interface TaskQueuePort<Request, Response> {
  enqueue(request: Readonly<Request>): Promise<Response>;
}

export interface SchedulerPort<Request, Response> {
  schedule(request: Readonly<Request>): Promise<Response>;
}
