// Scoped NSGlassEffectView integration. Container insertion follows the MIT
// electron-liquid-glass project; see LICENSE. Only public AppKit APIs are used.
#import <AppKit/AppKit.h>
#import <objc/runtime.h>
#include <node_api.h>
#include <vector>
#include <cmath>
@interface NoriGlassView : NSGlassEffectView
@end
@implementation NoriGlassView
- (NSView *)hitTest:(NSPoint)point { return nil; }
@end
static char regionKey;
struct Region {double x,y,width,height,radius;};
static double number(napi_env env,napi_value item,const char *key){napi_value value;double result=0;if(napi_get_named_property(env,item,key,&value)==napi_ok)napi_get_value_double(env,value,&result);return std::isfinite(result)?result:0;}
static napi_value update(napi_env env,napi_callback_info info){
 size_t count=3;napi_value args[3];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);napi_value result;napi_get_boolean(env,false,&result);
 if(count!=3)return result;bool buffer=false;napi_is_buffer(env,args[0],&buffer);if(!buffer)return result;
 void *pointer=nullptr;size_t bytes=0;napi_get_buffer_info(env,args[0],&pointer,&bytes);if(bytes<sizeof(void*))return result;
 bool array=false;napi_is_array(env,args[1],&array);if(!array)return result;uint32_t length=0;napi_get_array_length(env,args[1],&length);if(length>10)return result;
 bool dark=false;napi_get_value_bool(env,args[2],&dark);std::vector<Region> regions;
 for(uint32_t i=0;i<length;i++){napi_value item;napi_get_element(env,args[1],i,&item);regions.push_back({number(env,item,"x"),number(env,item,"y"),number(env,item,"width"),number(env,item,"height"),number(env,item,"radius")});}
 __block bool applied=false;NSView *root=(__bridge NSView*)*reinterpret_cast<void **>(pointer);
 auto work=^{if(!root)return;if(@available(macOS 26.0,*)){
  NSMutableArray<NSView*> *views=objc_getAssociatedObject(root,&regionKey);if(!views){views=[NSMutableArray new];objc_setAssociatedObject(root,&regionKey,views,OBJC_ASSOCIATION_RETAIN_NONATOMIC);}
  while(views.count>regions.size()){[views.lastObject removeFromSuperview];[views removeLastObject];}
  for(size_t i=0;i<regions.size();i++){
   const auto r=regions[i];if(i>=views.count){NoriGlassView *glass=[[NoriGlassView alloc] initWithFrame:NSZeroRect];[root addSubview:glass positioned:NSWindowBelow relativeTo:nil];[views addObject:glass];}
   NoriGlassView *glass=(NoriGlassView*)views[i];glass.frame=NSMakeRect(r.x,root.isFlipped?r.y:root.bounds.size.height-r.y-r.height,r.width,r.height);glass.cornerRadius=std::max(0.0,std::min(30.0,r.radius));glass.style=NSGlassEffectViewStyleRegular;glass.appearance=[NSAppearance appearanceNamed:dark?NSAppearanceNameDarkAqua:NSAppearanceNameAqua];glass.tintColor=dark?[NSColor colorWithRed:.09 green:.13 blue:.21 alpha:.12]:nil;
   if(@available(macOS 27.0,*))glass.effectIsInteractive=YES;
  }applied=true;
 }};
 if([NSThread isMainThread])work();else dispatch_sync(dispatch_get_main_queue(),work);
 napi_get_boolean(env,applied,&result);return result;
}
static napi_value init(napi_env env,napi_value exports){napi_value function;napi_create_function(env,"update",NAPI_AUTO_LENGTH,update,nullptr,&function);napi_set_named_property(env,exports,"update",function);return exports;}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
