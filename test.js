function fib2(n){
    if(n ===0 ) return 0;
    if (n === 1) return 1;
    if(n === 2) return 1;
    return  fib2(n-1)+ fib2(n-2);
}



function print(n){
    console.log(`Called with ${n}. Result: ${fib2(n)} `)
}

print(10)



