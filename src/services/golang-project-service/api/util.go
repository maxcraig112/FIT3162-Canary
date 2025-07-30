package api

import "net/http"

type Route struct {
	method      string
	pattern     string
	handlerFunc http.HandlerFunc
}
