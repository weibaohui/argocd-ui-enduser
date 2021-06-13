package rules

import (
	log "github.com/sirupsen/logrus"
	"strings"
	"sync"
)

type Rules struct {
	List map[string]*Rule
}
type Rule struct {
	Name   string
	Key    string
	Target string
}

var (
	rules      *Rules
	once       sync.Once
	defaultKey = "***default***"
)

func NewRules() *Rules {
	once.Do(func() {
		rules = &Rules{
			List: make(map[string]*Rule, 0),
		}
	})
	return rules
}
func init() {
	log.Trace("初始化Rules")
	NewRules().AddRule("/api", "https://127.0.0.1:32383").
		AddDefault("http://127.0.0.1:4000")
}
func (r *Rules) AddRule(key, target string) *Rules {
	r.List[key] = &Rule{
		Name:   key,
		Key:    key,
		Target: target,
	}
	return r
}

func (r *Rules) AddDefault(target string) *Rules {
	r.List[defaultKey] = &Rule{
		Name:   defaultKey,
		Key:    defaultKey,
		Target: target,
	}
	return r
}

func (r *Rules) Echo() {
	for s, rule := range r.List {
		log.WithField("Rules", s).Info(rule.Key, rule.Target)
	}
}
func (r *Rules) FindTargetByUrl(url string) string {
	for k, v := range r.List {
		if k == defaultKey {
			continue
		}
		if strings.HasPrefix(url, v.Key) {
			return r.FindTargetByKey(v.Key)
		}
	}
	return r.FindDefaultTarget()
}

func (r *Rules) FindDefaultTarget() string {
	//默认地址
	target := ""
	dr := r.List[defaultKey]
	if dr != nil {
		target = dr.Target
	}
	return target
}

func (r *Rules) FindTargetByKey(key string) string {

	if key == defaultKey {
		return r.FindDefaultTarget()
	}
	//其他地址key目的地址
	kv := r.List[key]
	if kv != nil {
		return kv.Target
	}
	//保底返回默认地址，可能为""
	return r.FindDefaultTarget()
}
