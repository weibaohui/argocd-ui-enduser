package main

/**
正向代理
*/

import (
	"crypto/tls"
	"fmt"
	log "github.com/sirupsen/logrus"
	"io"
	"net/http"
	"net/url"
	"server/rules"
)

type Proxy struct {
}

func (p *Proxy) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	reqUrl := req.URL.Path
	fmt.Printf("接受请求 %s %s %s \n", req.Method, req.Host, reqUrl)

	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	// 第一步： 代理接受到客户端的请求，复制原来的请求对象
	outReq := new(http.Request)
	*outReq = *req // 这只是一个浅层拷贝

	targetHost := rules.NewRules().FindTargetByUrl(reqUrl)
	urlx, err := url.Parse(targetHost + reqUrl)
	if err != nil {
		log.Error(err.Error())
		return
	}
	outReq.URL = urlx

	// 第二步： 把新请求复制到服务器端，并接收到服务器端返回的响应
	res, err := transport.RoundTrip(outReq)
	if err != nil {
		log.Error(err.Error())
		w.WriteHeader(http.StatusBadGateway) // 502
		return
	}

	// 第三步：代理服务器对响应做一些处理，然后返回给客户端
	for key, value := range res.Header {
		for _, v := range value {
			w.Header().Add(key, v)
		}
	}

	w.WriteHeader(res.StatusCode)
	defer res.Body.Close()
	io.Copy(w, res.Body)
}
