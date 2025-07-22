package api

import "net/http"

type route struct {
	method      string
	pattern     string
	handlerFunc http.HandlerFunc
}
